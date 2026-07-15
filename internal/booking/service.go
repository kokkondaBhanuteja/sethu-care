package booking

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// NOTE ON PURITY. This file is the IMPURE half of the module — it may import pgx, a pool,
// context. The pure half (state.go, statemachine.go) may not, and depguard enforces that.
// The split is the point: Apply() below decides WHAT to persist by asking the pure
// machine, then persists it. The rules and their storage never mix.

// ErrBookingNotFound is returned when the id does not exist.
var ErrBookingNotFound = errors.New("booking: not found")

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

func (e *ConflictError) Error() string {
	return fmt.Sprintf("booking %s was modified concurrently; %s did not apply", e.BookingID, e.Action)
}

// Service is the only way to change a booking. It owns the bookings aggregate (ROADMAP
// §4.2): no other module writes these rows.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// TransitionInput carries everything a transition might need beyond the action itself.
type TransitionInput struct {
	// Actor is who performed this. Nil for transitions the system made on its own.
	Actor *uuid.UUID
	// AssignTechnician is set only for ASSIGN; ignored otherwise.
	AssignTechnician *uuid.UUID
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
func (s *Service) Apply(ctx context.Context, bookingID uuid.UUID, action Action, in TransitionInput) (State, error) {
	var newState State

	err := storage.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := sqlcgen.New(tx)

		current, err := q.GetBookingState(ctx, bookingID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBookingNotFound
		}
		if err != nil {
			return fmt.Errorf("reading booking: %w", err)
		}

		from, err := ParseState(current.State)
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
		rows, err := q.ApplyBookingTransition(ctx, sqlcgen.ApplyBookingTransitionParams{
			ToState:         string(to),
			TechnicianID:    in.AssignTechnician,
			ID:              bookingID,
			ExpectedVersion: current.Version,
		})
		if err != nil {
			return fmt.Errorf("applying transition: %w", err)
		}
		if rows == 0 {
			return &ConflictError{BookingID: bookingID, Action: action}
		}

		// APPEND-ONLY, same transaction. The log can never disagree with the row above.
		if err := q.InsertBookingEvent(ctx, sqlcgen.InsertBookingEventParams{
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
				BookingID: bookingID,
				From:      from,
				Action:    action,
				To:        to,
			})
			if err != nil {
				return fmt.Errorf("marshalling outbox payload: %w", err)
			}
			if err := q.InsertOutboxEvent(ctx, sqlcgen.InsertOutboxEventParams{
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
	BookingID uuid.UUID `json:"booking_id"`
	From      State     `json:"from"`
	Action    Action    `json:"action"`
	To        State     `json:"to"`
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
	case ActionSearch, ActionRequestCompletion, ActionResume, ActionReschedule, ActionCancel:
		return "", false
	}
	return "", false
}
