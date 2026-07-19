// Package httpapi is the transport layer: it turns HTTP requests into domain-service calls
// and domain results (and errors) back into HTTP. It holds no business rules — those live in
// the domain packages. huma turns the typed operations here into the OpenAPI contract the
// mobile client is generated from.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/flow"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/reviews"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// Handler wires the booking HTTP operations to the domain services.
type Handler struct {
	bookings     *booking.Service
	verification *verification.Service
	reviews      *reviews.Service
	flow         *flow.Controller // optional; backs Idempotency-Key dedupe on create
	log          *slog.Logger
}

func New(bookings *booking.Service, verifier *verification.Service, reviewer *reviews.Service, control *flow.Controller, log *slog.Logger) *Handler {
	return &Handler{bookings: bookings, verification: verifier, reviews: reviewer, flow: control, log: log}
}

// RegisterHuma mounts the booking operations. The authorization rule for each is declared right
// at the route: creating a booking and reviewing require CUSTOMER; the job view requires
// TECHNICIAN; reading and transitioning require only authentication — the per-action role and
// ownership rules live in booking.Apply, because they depend on the booking and its owner.
func (handler *Handler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "createBooking", Method: http.MethodPost, Path: "/bookings",
		Summary: "Create a booking", Tags: []string{"Bookings"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleCustomer),
	}, handler.create)
	huma.Register(api, huma.Operation{
		OperationID: "getBooking", Method: http.MethodGet, Path: "/bookings/{id}",
		Summary: "Get a booking", Tags: []string{"Bookings"},
		Security: bearerSecurity(),
	}, handler.get)
	huma.Register(api, huma.Operation{
		OperationID: "transitionBooking", Method: http.MethodPost, Path: "/bookings/{id}/transitions",
		Summary: "Apply a state transition to a booking", Tags: []string{"Bookings"},
		Security: bearerSecurity(),
	}, handler.transition)
	huma.Register(api, huma.Operation{
		OperationID: "listMyBookings", Method: http.MethodGet, Path: "/me/bookings",
		Summary: "List my bookings", Tags: []string{"Bookings"},
		Security: bearerSecurity(),
	}, handler.myBookings)
	huma.Register(api, huma.Operation{
		OperationID: "listMyJobs", Method: http.MethodGet, Path: "/me/jobs",
		Summary: "List my assigned jobs", Tags: []string{"Bookings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleTechnician),
	}, handler.myJobs)
	huma.Register(api, huma.Operation{
		OperationID: "reviewBooking", Method: http.MethodPost, Path: "/bookings/{id}/review",
		Summary: "Review a completed booking", Tags: []string{"Bookings"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleCustomer),
	}, handler.review)
}

// --- shared DTOs ------------------------------------------------------------

type bookingResponse struct {
	BookingID        uuid.UUID `json:"booking_id"`
	OrderID          uuid.UUID `json:"order_id,omitempty"`
	State            string    `json:"state"`
	QuotedTotalPaise int64     `json:"quoted_total_paise"`
	AllowedActions   []string  `json:"allowed_actions,omitempty"`
}

type bookingOutput struct {
	Body bookingResponse
}

// --- POST /bookings ---------------------------------------------------------

// createRequest has no customer_id — the customer is the authenticated caller, taken from the
// token. Letting a client name the customer would let one customer book for another.
type createRequest struct {
	AddressID uuid.UUID `json:"address_id"`
	VariantID uuid.UUID `json:"variant_id"`
	Quantity  int32     `json:"quantity"`
}

type createBookingInput struct {
	// IdempotencyKey lets a client safely retry (or double-tap) create without making two bookings:
	// the same key returns the first result. Optional.
	IdempotencyKey string `header:"Idempotency-Key"`
	Body           createRequest
}

func (handler *Handler) create(ctx context.Context, input *createBookingInput) (*bookingOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}

	// Idempotency: dedupe retries/double-taps. The key is scoped to the caller so one user's key can
	// never return another's booking. A lock serialises simultaneous requests with the same key; the
	// cache short-circuits sequential ones. Degrades cleanly when Redis is absent (no dedupe).
	idemKey := ""
	if input.IdempotencyKey != "" && handler.flow != nil {
		idemKey = "booking:" + caller.ID.String() + ":" + input.IdempotencyKey
		release, _, _ := handler.flow.LockWait(ctx, idemKey, 10*time.Second, 3*time.Second)
		defer release()
		if cached, found, _ := handler.flow.Recall(ctx, idemKey); found {
			var resp bookingResponse
			if json.Unmarshal([]byte(cached), &resp) == nil {
				return &bookingOutput{Body: resp}, nil
			}
		}
	}

	created, err := handler.bookings.Create(ctx, booking.CreateInput{
		CustomerID: caller.ID, // the booker is the authenticated caller, never a body field
		AddressID:  input.Body.AddressID,
		VariantID:  input.Body.VariantID,
		Quantity:   input.Body.Quantity,
	})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	resp := bookingResponse{
		BookingID:        created.BookingID,
		OrderID:          created.OrderID,
		State:            created.State.String(),
		QuotedTotalPaise: created.QuotedTotal.Paise(),
		AllowedActions:   actionStrings(booking.AllowedActions(created.State)),
	}
	if idemKey != "" {
		if encoded, err := json.Marshal(resp); err == nil {
			_ = handler.flow.Remember(ctx, idemKey, string(encoded), 10*time.Minute)
		}
	}
	return &bookingOutput{Body: resp}, nil
}

// --- GET /bookings/{id} -----------------------------------------------------

func (handler *Handler) get(ctx context.Context, input *bookingIDInput) (*bookingOutput, error) {
	id, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	view, err := handler.bookings.Get(ctx, id)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &bookingOutput{Body: bookingResponse{
		BookingID:        view.ID,
		State:            view.State.String(),
		QuotedTotalPaise: view.QuotedTotal.Paise(),
		AllowedActions:   actionStrings(view.AllowedActions),
	}}, nil
}

// --- POST /bookings/{id}/transitions ---------------------------------------

type transitionRequest struct {
	Action     string     `json:"action"`
	Technician *uuid.UUID `json:"technician_id,omitempty"`
	// Code is the dual-OTP code, required for VERIFY_START and VERIFY_COMPLETION.
	Code string `json:"code,omitempty"`
	// PaymentMethod (UPI/CASH/ONLINE) is required for VERIFY_COMPLETION — how the customer paid.
	PaymentMethod string `json:"payment_method,omitempty"`
}

type transitionBookingInput struct {
	ID   string `path:"id" format:"uuid" doc:"Booking id"`
	Body transitionRequest
}

func (handler *Handler) transition(ctx context.Context, input *transitionBookingInput) (*bookingOutput, error) {
	id, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	action := booking.Action(input.Body.Action)
	if !action.Valid() {
		return nil, toHumaError(handler.log, &badRequestError{msg: "unknown action: " + input.Body.Action})
	}

	// The actor is the authenticated caller — attributed to the booking_events row, and
	// forgery-proof, because it comes from the verified token, not a header.
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	actor := caller.ID

	transitionInput := booking.TransitionInput{
		Actor:            &actor,
		ActorRole:        caller.Role,
		AssignTechnician: input.Body.Technician,
	}
	// VERIFY_START / VERIFY_COMPLETION gate on the dual OTP. Build the guard so the code check
	// and the state change happen in one transaction.
	if purpose, needsOTP := otpPurposeFor(action); needsOTP {
		if input.Body.Code == "" {
			return nil, toHumaError(handler.log, &badRequestError{msg: "code is required for " + input.Body.Action})
		}
		transitionInput.Guard = handler.verification.Guard(id, purpose, input.Body.Code)
	}

	// Completion also captures how the customer paid — it rides the booking.completed event to
	// the ledger.
	if action == booking.ActionVerifyCompletion {
		if !ledger.PaymentMethod(input.Body.PaymentMethod).Valid() {
			return nil, toHumaError(handler.log, &badRequestError{msg: "payment_method must be UPI, CASH, or ONLINE"})
		}
		transitionInput.PaymentMethod = input.Body.PaymentMethod
	}

	newState, err := handler.bookings.Apply(ctx, id, action, transitionInput)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &bookingOutput{Body: bookingResponse{
		BookingID:      id,
		State:          newState.String(),
		AllowedActions: actionStrings(booking.AllowedActions(newState)),
	}}, nil
}

// otpPurposeFor maps the two OTP-gated actions to their challenge purpose. Exhaustive-linted,
// so a new action cannot ship without a decision about whether it needs an OTP.
func otpPurposeFor(action booking.Action) (verification.Purpose, bool) {
	switch action {
	case booking.ActionVerifyStart:
		return verification.PurposeStart, true
	case booking.ActionVerifyCompletion:
		return verification.PurposeCompletion, true
	case booking.ActionConfirm, booking.ActionSearch, booking.ActionAssign, booking.ActionDepart,
		booking.ActionArrive, booking.ActionRequestCompletion, booking.ActionResume,
		booking.ActionEscalate, booking.ActionReschedule, booking.ActionCancel, booking.ActionFail:
		return "", false
	}
	return "", false
}

// --- GET /me/bookings -------------------------------------------------------

type summaryResponse struct {
	BookingID    string     `json:"booking_id"`
	State        string     `json:"state"`
	ServiceName  string     `json:"service_name"`
	City         string     `json:"city"`
	ScheduledFor *time.Time `json:"scheduled_for,omitempty"`
	QuotedTotal  string     `json:"quoted_total"`
	CreatedAt    time.Time  `json:"created_at"`
}

type myBookingsOutput struct {
	Body struct {
		Bookings []summaryResponse `json:"bookings"`
	}
}

func (handler *Handler) myBookings(ctx context.Context, _ *struct{}) (*myBookingsOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	summaries, err := handler.bookings.ListForCustomer(ctx, caller.ID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &myBookingsOutput{}
	out.Body.Bookings = make([]summaryResponse, len(summaries))
	for index, summary := range summaries {
		out.Body.Bookings[index] = summaryResponse{
			BookingID:    summary.BookingID.String(),
			State:        summary.State.String(),
			ServiceName:  summary.ServiceName,
			City:         summary.City,
			ScheduledFor: summary.ScheduledFor,
			QuotedTotal:  summary.QuotedTotal.Rupees(),
			CreatedAt:    summary.CreatedAt,
		}
	}
	return out, nil
}

// --- GET /me/jobs -----------------------------------------------------------

type jobResponse struct {
	BookingID      string     `json:"booking_id"`
	State          string     `json:"state"`
	AllowedActions []string   `json:"allowed_actions"`
	CustomerName   string     `json:"customer_name"`
	CustomerPhone  string     `json:"customer_phone"`
	ServiceName    string     `json:"service_name"`
	Line1          string     `json:"line1"`
	City           string     `json:"city"`
	Pincode        string     `json:"pincode"`
	Lat            float64    `json:"lat"`
	Lng            float64    `json:"lng"`
	ScheduledFor   *time.Time `json:"scheduled_for,omitempty"`
	QuotedTotal    string     `json:"quoted_total"`
}

type myJobsOutput struct {
	Body struct {
		Jobs []jobResponse `json:"jobs"`
	}
}

func (handler *Handler) myJobs(ctx context.Context, _ *struct{}) (*myJobsOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	jobs, err := handler.bookings.ListForTechnician(ctx, caller.ID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &myJobsOutput{}
	out.Body.Jobs = make([]jobResponse, len(jobs))
	for index, job := range jobs {
		out.Body.Jobs[index] = jobResponse{
			BookingID:      job.BookingID.String(),
			State:          job.State.String(),
			AllowedActions: actionStrings(job.AllowedActions),
			CustomerName:   job.CustomerName,
			CustomerPhone:  job.CustomerPhone,
			ServiceName:    job.ServiceName,
			Line1:          job.Line1,
			City:           job.City,
			Pincode:        job.Pincode,
			Lat:            job.Lat,
			Lng:            job.Lng,
			ScheduledFor:   job.ScheduledFor,
			QuotedTotal:    job.QuotedTotal.Rupees(),
		}
	}
	return out, nil
}

// --- POST /bookings/{id}/review --------------------------------------------

type reviewRequest struct {
	Rating  int32  `json:"rating"`
	Comment string `json:"comment"`
}

type reviewBookingInput struct {
	ID   string `path:"id" format:"uuid" doc:"Booking id"`
	Body reviewRequest
}

type statusOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func (handler *Handler) review(ctx context.Context, input *reviewBookingInput) (*statusOutput, error) {
	id, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if err := handler.reviews.Submit(ctx, id, caller.ID, input.Body.Rating, input.Body.Comment); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &statusOutput{}
	out.Body.Status = "recorded"
	return out, nil
}

// --- helpers ----------------------------------------------------------------

func parseUUID(raw, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, &badRequestError{msg: "invalid " + name + ": must be a uuid"}
	}
	return id, nil
}

func actionStrings(actions []booking.Action) []string {
	names := make([]string, len(actions))
	for index, action := range actions {
		names[index] = action.String()
	}
	return names
}
