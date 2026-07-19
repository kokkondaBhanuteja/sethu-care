package booking

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// NOTE ON PURITY. This file is the IMPURE half of the module — it may import pgx, a pool,
// context. The pure half (state.go, statemachine.go) may not, and depguard enforces that.
// The split is the point: Apply() below decides WHAT to persist by asking the pure
// machine, then persists it. The rules and their storage never mix.

// ErrBookingNotFound is returned when the id does not exist.
var ErrBookingNotFound = errors.New("booking: not found")

// Creation-time validation failures. These are the caller's fault (a 4xx), not ours.
var (
	ErrVariantNotFound = errors.New("booking: service variant not found")
	ErrVariantInactive = errors.New("booking: service variant is not active")
	ErrInvalidQuantity = errors.New("booking: quantity must be at least 1")
)

// ConflictError means someone moved this booking between our read and our write — the
// optimistic-lock CAS matched zero rows. The HTTP layer turns this into a 409.
//
// This is not a failure; it is the guard working. Two admins assigned the same booking,
// and this one lost the race. The booking is fine — it is just no longer where this caller
// thought it was.
type ConflictError struct {
	BookingID uuid.UUID
	Action    Action
}

func (conflict *ConflictError) Error() string {
	return fmt.Sprintf("booking %s was modified concurrently; %s did not apply", conflict.BookingID, conflict.Action)
}

// ScheduleConflictError means the assignment would double-book the technician — their
// [scheduled_for, scheduled_end) window overlaps another live job. This is the cross-row
// invariant that `version` cannot see (two different bookings, two different versions); the
// database's bookings_no_double_book EXCLUDE constraint (SQLSTATE 23P01) is the one that
// catches it. The HTTP layer turns this into a 409 — dispatch should pick a different
// technician or slot.
type ScheduleConflictError struct {
	BookingID    uuid.UUID
	TechnicianID *uuid.UUID
}

func (conflict *ScheduleConflictError) Error() string {
	return fmt.Sprintf("technician is already booked for that time window; booking %s not assigned", conflict.BookingID)
}

// ForbiddenError means the actor is not allowed to perform this action — either their role
// cannot do it at all, or it is not their booking to act on. The HTTP layer turns this into
// a 403.
type ForbiddenError struct {
	Role   identity.Role
	Action Action
	Reason string
}

func (forbidden *ForbiddenError) Error() string {
	return fmt.Sprintf("%s may not %s: %s", forbidden.Role, forbidden.Action, forbidden.Reason)
}

// Service is the only way to change a booking. It owns the bookings aggregate (ROADMAP
// §4.2): no other module writes these rows.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// CreateInput is a request to place a booking.
//
// The caller supplies the variant (not a price — the price comes from the catalog) and the
// service is derived from the variant, so a booking can never be priced by the client or
// reference a variant belonging to another service.
type CreateInput struct {
	CustomerID uuid.UUID
	AddressID  uuid.UUID
	VariantID  uuid.UUID
	Quantity   int32
}

// Created is what Create returns: enough to drive the next step.
type Created struct {
	BookingID   uuid.UUID
	OrderID     uuid.UUID
	State       State
	QuotedTotal money.Money
}

// Create places a booking: an order (the purchase), a booking (the visit) in DRAFT, its
// single item, and a booking.created outbox event — all in ONE transaction.
//
// In P0 an order and its single booking are born together, because §4.6's invariant is
// one-order-one-booking. So this creation path lives in the booking service. When P3 splits
// purchase from visit (a cart of several services fanning out to several bookings), order
// creation moves to an order service and this composes with it — but the seam (a separate
// orders row that money attaches to) is already here.
func (service *Service) Create(ctx context.Context, in CreateInput) (Created, error) {
	if in.Quantity < 1 {
		return Created{}, ErrInvalidQuantity
	}

	var out Created
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		variant, err := queries.GetServiceVariant(ctx, in.VariantID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrVariantNotFound
		}
		if err != nil {
			return fmt.Errorf("reading variant: %w", err)
		}
		if !variant.IsActive {
			return ErrVariantInactive
		}

		// The total is computed here, in Money, never taken from the client.
		lineTotal := variant.BasePricePaise.Mul(int(in.Quantity))

		orderID, err := queries.CreateOrder(ctx, sqlcgen.CreateOrderParams{
			CustomerID: in.CustomerID,
			TotalPaise: lineTotal,
		})
		if err != nil {
			return fmt.Errorf("creating order: %w", err)
		}

		booking, err := queries.CreateBooking(ctx, sqlcgen.CreateBookingParams{
			OrderID:          orderID,
			CustomerID:       in.CustomerID,
			AddressID:        in.AddressID,
			QuotedTotalPaise: lineTotal,
			DurationMinutes:  variant.EstimatedMinutes,
		})
		if err != nil {
			return fmt.Errorf("creating booking: %w", err)
		}

		if err := queries.CreateBookingItem(ctx, sqlcgen.CreateBookingItemParams{
			BookingID:      booking.ID,
			ServiceID:      variant.ServiceID,
			VariantID:      in.VariantID,
			Quantity:       in.Quantity,
			LineTotalPaise: lineTotal,
		}); err != nil {
			return fmt.Errorf("creating booking item: %w", err)
		}

		payload, err := json.Marshal(createdEvent{
			BookingID:        booking.ID,
			OrderID:          orderID,
			CustomerID:       in.CustomerID,
			QuotedTotalPaise: lineTotal.Paise(),
		})
		if err != nil {
			return fmt.Errorf("marshalling booking.created: %w", err)
		}
		if err := queries.InsertOutboxEvent(ctx, sqlcgen.InsertOutboxEventParams{
			AggregateType: "booking",
			AggregateID:   booking.ID,
			EventType:     "booking.created",
			Payload:       payload,
		}); err != nil {
			return fmt.Errorf("writing booking.created: %w", err)
		}

		state, err := ParseState(booking.State)
		if err != nil {
			return err
		}
		out = Created{BookingID: booking.ID, OrderID: orderID, State: state, QuotedTotal: lineTotal}
		return nil
	})

	if err != nil {
		return Created{}, err
	}
	return out, nil
}

type createdEvent struct {
	BookingID        uuid.UUID `json:"booking_id"`
	OrderID          uuid.UUID `json:"order_id"`
	CustomerID       uuid.UUID `json:"customer_id"`
	QuotedTotalPaise int64     `json:"quoted_total_paise"`
}

// View is a read of a booking's current position, for the GET endpoint and callers that
// need to know what to do next.
type View struct {
	ID             uuid.UUID
	State          State
	TechnicianID   *uuid.UUID
	QuotedTotal    money.Money
	AllowedActions []Action
}

// Get reads a booking and the actions currently legal on it.
func (service *Service) Get(ctx context.Context, bookingID uuid.UUID) (View, error) {
	row, err := sqlcgen.New(service.pool).GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrBookingNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("reading booking: %w", err)
	}
	state, err := ParseState(row.State)
	if err != nil {
		return View{}, err
	}
	return View{
		ID:             row.ID,
		State:          state,
		TechnicianID:   row.TechnicianID,
		QuotedTotal:    row.QuotedTotalPaise,
		AllowedActions: AllowedActions(state),
	}, nil
}

// Summary is a booking as it appears in a customer's history.
type Summary struct {
	BookingID    uuid.UUID
	State        State
	ServiceName  string
	City         string
	ScheduledFor *time.Time
	QuotedTotal  money.Money
	CreatedAt    time.Time
}

// ListForCustomer returns a customer's own bookings, newest first.
func (service *Service) ListForCustomer(ctx context.Context, customerID uuid.UUID) ([]Summary, error) {
	rows, err := sqlcgen.New(service.pool).ListCustomerBookings(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("listing customer bookings: %w", err)
	}
	summaries := make([]Summary, len(rows))
	for index, row := range rows {
		state, err := ParseState(row.State)
		if err != nil {
			return nil, err
		}
		summaries[index] = Summary{
			BookingID:    row.ID,
			State:        state,
			ServiceName:  row.ServiceName,
			City:         row.City,
			ScheduledFor: timePointer(row.ScheduledFor),
			QuotedTotal:  row.QuotedTotalPaise,
			CreatedAt:    row.CreatedAt.Time,
		}
	}
	return summaries, nil
}

// Job is one of a technician's active jobs, with the on-site context and the actions THIS
// technician may take next (legal-from-state ∩ permitted-for-technician).
type Job struct {
	BookingID      uuid.UUID
	State          State
	AllowedActions []Action
	CustomerName   string
	CustomerPhone  string
	ServiceName    string
	Line1          string
	City           string
	Pincode        string
	Lat            float64
	Lng            float64
	ScheduledFor   *time.Time
	QuotedTotal    money.Money
}

// ListForTechnician returns the active jobs assigned to a technician, each annotated with the
// actions they can take right now — so the app shows exactly the buttons that will work.
//
// NOTE: this joins across users/services/addresses for display. It is a read-only denormalised
// view; the write ownership of those aggregates stays with their modules (ROADMAP §4.2).
func (service *Service) ListForTechnician(ctx context.Context, technicianID uuid.UUID) ([]Job, error) {
	rows, err := sqlcgen.New(service.pool).ListTechnicianJobs(ctx, &technicianID)
	if err != nil {
		return nil, fmt.Errorf("listing technician jobs: %w", err)
	}
	jobs := make([]Job, len(rows))
	for index, row := range rows {
		state, err := ParseState(row.State)
		if err != nil {
			return nil, err
		}
		jobs[index] = Job{
			BookingID:      row.ID,
			State:          state,
			AllowedActions: technicianActions(state),
			CustomerName:   row.CustomerName,
			CustomerPhone:  row.CustomerPhone,
			ServiceName:    row.ServiceName,
			Line1:          row.Line1,
			City:           row.City,
			Pincode:        row.Pincode,
			Lat:            row.Lat,
			Lng:            row.Lng,
			ScheduledFor:   timePointer(row.ScheduledFor),
			QuotedTotal:    row.QuotedTotalPaise,
		}
	}
	return jobs, nil
}

// technicianActions is the legal-from-here actions a TECHNICIAN is allowed to perform.
func technicianActions(state State) []Action {
	permitted := make([]Action, 0, 2)
	for _, action := range AllowedActions(state) {
		if CanPerform(identity.RoleTechnician, action) {
			permitted = append(permitted, action)
		}
	}
	return permitted
}

func timePointer(timestamp pgtype.Timestamptz) *time.Time {
	if !timestamp.Valid {
		return nil
	}
	return &timestamp.Time
}

// TransitionInput carries everything a transition might need beyond the action itself.
type TransitionInput struct {
	// Actor is who performed this. Nil for transitions the system made on its own — a nil
	// actor skips the ownership check (the system is trusted) but still obeys the role rule.
	Actor *uuid.UUID
	// ActorRole is the actor's role, used for authorization (see CanPerform).
	ActorRole identity.Role
	// AssignTechnician is set only for ASSIGN; ignored otherwise.
	AssignTechnician *uuid.UUID
	// Guard, if set, runs inside the transaction after authorization and before the state
	// change. If it returns an error, NOTHING is written — the transaction rolls back. This is
	// how VERIFY_START / VERIFY_COMPLETION gate on the dual OTP: the code check and the state
	// change are one atomic step, so you can never spend an OTP without advancing the booking,
	// nor advance without a valid code.
	Guard func(context.Context, pgx.Tx) error
	// PaymentMethod is carried into the booking.completed event (UPI/CASH/ONLINE) so the
	// ledger consumer knows how the customer paid. Only meaningful for VERIFY_COMPLETION.
	PaymentMethod string
}

// authorize enforces both halves of access control: the role may perform the action at all
// (CanPerform), AND the actor owns this booking. ADMIN and system (nil actor) bypass
// ownership; a customer may only touch their own booking; a technician only a job assigned
// to them.
func authorize(in TransitionInput, bookingRow sqlcgen.GetBookingRow, action Action) error {
	if !CanPerform(in.ActorRole, action) {
		return &ForbiddenError{Role: in.ActorRole, Action: action, Reason: "role is not permitted to perform this action"}
	}
	if in.ActorRole == identity.RoleAdmin || in.Actor == nil {
		return nil
	}
	switch in.ActorRole {
	case identity.RoleCustomer:
		if bookingRow.CustomerID != *in.Actor {
			return &ForbiddenError{Role: in.ActorRole, Action: action, Reason: "not your booking"}
		}
	case identity.RoleTechnician:
		if bookingRow.TechnicianID == nil || *bookingRow.TechnicianID != *in.Actor {
			return &ForbiddenError{Role: in.ActorRole, Action: action, Reason: "booking is not assigned to you"}
		}
	case identity.RoleAdmin:
		// Unreachable: admin returned above. Named so the exhaustive linter is satisfied and
		// a new role cannot be added without deciding its ownership rule here.
	}
	return nil
}

// Apply moves a booking through one transition, atomically.
//
// In ONE transaction it: reads the current (state, version); asks the PURE state machine
// whether the action is legal from there; compare-and-swaps the new state (guarded by
// version); appends an immutable booking_events row; and, when the transition has a
// published event (ROADMAP §8), inserts an outbox row. Either all of that lands or none of
// it does.
//
// Returns the new state, or:
//   - *IllegalTransitionError — the action is not legal from the current state (nothing written)
//   - *ConflictError          — someone else moved the booking first (nothing written)
//   - ErrBookingNotFound      — no such booking
func (service *Service) Apply(ctx context.Context, bookingID uuid.UUID, action Action, in TransitionInput) (State, error) {
	var newState State

	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		bookingRow, err := queries.GetBooking(ctx, bookingID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBookingNotFound
		}
		if err != nil {
			return fmt.Errorf("reading booking: %w", err)
		}

		// AUTHORIZE before anything else, and before the pure legality check — an
		// unauthorized caller should not even learn whether the transition was legal.
		if err := authorize(in, bookingRow, action); err != nil {
			return err
		}

		// GUARD runs in this transaction (the OTP check for VERIFY_* actions). A failure here
		// rolls back everything: no OTP consumed, no state change.
		if in.Guard != nil {
			if err := in.Guard(ctx, tx); err != nil {
				return err
			}
		}

		from, err := ParseState(bookingRow.State)
		if err != nil {
			// The database holds a state Go does not know. This should be impossible —
			// ParseState guards every write path — so if it happens, something bypassed us.
			return fmt.Errorf("booking %s is in an unknown state: %w", bookingID, err)
		}

		// THE PURE DECISION. No I/O. If this rejects, we have written nothing.
		to, err := Apply(from, action)
		if err != nil {
			return err
		}

		// THE COMPARE-AND-SWAP. version is the guard: zero rows means someone raced us.
		rows, err := queries.ApplyBookingTransition(ctx, sqlcgen.ApplyBookingTransitionParams{
			ToState:         string(to),
			TechnicianID:    in.AssignTechnician,
			ID:              bookingID,
			ExpectedVersion: bookingRow.Version,
		})
		if err != nil {
			// The cross-row schedule guard: assigning this technician would overlap another live
			// job (bookings_no_double_book). Surface it as a clean 409, not a 500.
			if storage.IsSQLState(err, storage.SQLStateExclusionViolation) {
				return &ScheduleConflictError{BookingID: bookingID, TechnicianID: in.AssignTechnician}
			}
			return fmt.Errorf("applying transition: %w", err)
		}
		if rows == 0 {
			return &ConflictError{BookingID: bookingID, Action: action}
		}

		// APPEND-ONLY, same transaction. The log can never disagree with the row above.
		if err := queries.InsertBookingEvent(ctx, sqlcgen.InsertBookingEventParams{
			BookingID:   bookingID,
			FromState:   string(from),
			Action:      string(action),
			ToState:     string(to),
			ActorUserID: in.Actor,
			Meta:        []byte("{}"),
		}); err != nil {
			return fmt.Errorf("writing booking event: %w", err)
		}

		// THE OUTBOX. Only transitions with a published event (§8) get a row. The event
		// lands in this same transaction, so it cannot be lost if we crash after commit.
		if eventType, ok := publishedEventFor(action); ok {
			payload, err := json.Marshal(transitionEvent{
				BookingID:     bookingID,
				From:          from,
				Action:        action,
				To:            to,
				PaymentMethod: in.PaymentMethod,
			})
			if err != nil {
				return fmt.Errorf("marshalling outbox payload: %w", err)
			}
			if err := queries.InsertOutboxEvent(ctx, sqlcgen.InsertOutboxEventParams{
				AggregateType: "booking",
				AggregateID:   bookingID,
				EventType:     eventType,
				Payload:       payload,
			}); err != nil {
				return fmt.Errorf("writing outbox event: %w", err)
			}
		}

		newState = to
		return nil
	})

	if err != nil {
		return "", err
	}
	return newState, nil
}

type transitionEvent struct {
	BookingID     uuid.UUID `json:"booking_id"`
	From          State     `json:"from"`
	Action        Action    `json:"action"`
	To            State     `json:"to"`
	PaymentMethod string    `json:"payment_method,omitempty"`
}

// publishedEventFor maps an action to its ROADMAP §8 event name, or (,"false") when the
// transition has no published event yet.
//
// GO LESSON — this switch is watched by the `exhaustive` linter. Add a 14th Action and the
// build fails here until you decide, explicitly, whether it publishes an event. That is the
// enum safety we bought back (ROADMAP §7a) doing real work: it will not let a new action
// quietly slip through with no notification.
//
// KNOWN GAP, surfaced not hidden: CANCEL and RESCHEDULE have no §8 event, so a cancelled
// booking currently notifies nobody. §8 is the P0 catalog; booking.cancelled /
// booking.rescheduled must be ADDED to it (and to this switch) before those flows ship.
func publishedEventFor(action Action) (string, bool) {
	switch action {
	case ActionConfirm:
		return "booking.confirmed", true
	case ActionAssign:
		return "booking.assigned", true
	case ActionDepart:
		return "technician.en_route", true
	case ActionArrive:
		return "technician.arrived", true
	case ActionVerifyStart:
		return "booking.started", true
	case ActionVerifyCompletion:
		return "booking.completed", true
	case ActionEscalate:
		return "booking.escalated", true
	case ActionFail:
		return "booking.failed", true
	case ActionRequestCompletion:
		// Not in the original §8 catalog, added here: it triggers issuing the completion OTP
		// (the technician says the work is done; the customer gets a code to confirm it).
		return "booking.awaiting_completion", true
	case ActionCancel:
		return "booking.cancelled", true
	case ActionReschedule:
		return "booking.rescheduled", true
	case ActionSearch, ActionResume:
		return "", false
	}
	return "", false
}
