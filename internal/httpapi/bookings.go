// Package httpapi is the transport layer: it turns HTTP requests into domain-service calls
// and domain results (and errors) back into HTTP. It holds no business rules — those live in
// the domain packages. Keeping transport separate is why the same booking.Service can later
// be driven by a gRPC or a queue consumer without change.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/shared/response"
)

// Handler wires the HTTP routes to the domain services.
type Handler struct {
	bookings *booking.Service
	signer   *auth.Signer
	log      *slog.Logger
}

func New(bookings *booking.Service, signer *auth.Signer, log *slog.Logger) *Handler {
	return &Handler{bookings: bookings, signer: signer, log: log}
}

// Register mounts the booking endpoints onto mux, each wrapped in the auth it requires. The
// authorization rule for every route is visible right here, at the route — not buried in the
// handler.
//
// Creating a booking requires CUSTOMER; the technician job view requires TECHNICIAN. Reading
// and transitioning require only authentication at the transport layer — the per-action role
// and ownership rules live in booking.Apply (see CanPerform and authorize), because they
// depend on the booking and its owner.
func (handler *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /bookings",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleCustomer, http.HandlerFunc(handler.create))))
	mux.Handle("GET /bookings/{id}",
		handler.signer.RequireAuth(http.HandlerFunc(handler.get)))
	mux.Handle("POST /bookings/{id}/transitions",
		handler.signer.RequireAuth(http.HandlerFunc(handler.transition)))
	// A technician's own active jobs. TECHNICIAN-only, filtered to the caller.
	mux.Handle("GET /me/jobs",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleTechnician, http.HandlerFunc(handler.myJobs))))
}

// --- POST /bookings ---------------------------------------------------------

// createRequest has no customer_id — the customer is the authenticated caller, taken from
// the token. Letting a client name the customer would let one customer book for another.
type createRequest struct {
	AddressID uuid.UUID `json:"address_id"`
	VariantID uuid.UUID `json:"variant_id"`
	Quantity  int32     `json:"quantity"`
}

type bookingResponse struct {
	BookingID        uuid.UUID `json:"booking_id"`
	OrderID          uuid.UUID `json:"order_id,omitempty"`
	State            string    `json:"state"`
	QuotedTotalPaise int64     `json:"quoted_total_paise"`
	AllowedActions   []string  `json:"allowed_actions,omitempty"`
}

func (handler *Handler) create(writer http.ResponseWriter, request *http.Request) {
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}

	var req createRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}

	created, err := handler.bookings.Create(request.Context(), booking.CreateInput{
		CustomerID: caller.ID, // the booker is the authenticated caller, never a body field
		AddressID:  req.AddressID,
		VariantID:  req.VariantID,
		Quantity:   req.Quantity,
	})
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}

	writeJSON(writer, http.StatusCreated, bookingResponse{
		BookingID:        created.BookingID,
		OrderID:          created.OrderID,
		State:            created.State.String(),
		QuotedTotalPaise: created.QuotedTotal.Paise(),
		AllowedActions:   actionStrings(booking.AllowedActions(created.State)),
	})
}

// --- GET /bookings/{id} -----------------------------------------------------

func (handler *Handler) get(writer http.ResponseWriter, request *http.Request) {
	id, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}

	view, err := handler.bookings.Get(request.Context(), id)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}

	writeJSON(writer, http.StatusOK, bookingResponse{
		BookingID:        view.ID,
		State:            view.State.String(),
		QuotedTotalPaise: view.QuotedTotal.Paise(),
		AllowedActions:   actionStrings(view.AllowedActions),
	})
}

// --- POST /bookings/{id}/transitions ---------------------------------------

type transitionRequest struct {
	Action     string     `json:"action"`
	Technician *uuid.UUID `json:"technician_id,omitempty"`
}

func (handler *Handler) transition(writer http.ResponseWriter, request *http.Request) {
	id, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}

	var req transitionRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}

	action := booking.Action(req.Action)
	if !action.Valid() {
		writeError(writer, handler.log, &badRequestError{msg: "unknown action: " + req.Action})
		return
	}

	// The actor is the authenticated caller — attributed to the booking_events row, and
	// forgery-proof, because it comes from the verified token, not a header.
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	actor := caller.ID

	newState, err := handler.bookings.Apply(request.Context(), id, action, booking.TransitionInput{
		Actor:            &actor,
		ActorRole:        caller.Role,
		AssignTechnician: req.Technician,
	})
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}

	writeJSON(writer, http.StatusOK, bookingResponse{
		BookingID:      id,
		State:          newState.String(),
		AllowedActions: actionStrings(booking.AllowedActions(newState)),
	})
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

func (handler *Handler) myJobs(writer http.ResponseWriter, request *http.Request) {
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	jobs, err := handler.bookings.ListForTechnician(request.Context(), caller.ID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]jobResponse, len(jobs))
	for index, job := range jobs {
		payload[index] = jobResponse{
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
	writeJSON(writer, http.StatusOK, map[string]any{"jobs": payload})
}

// --- helpers ----------------------------------------------------------------

func pathUUID(request *http.Request, name string) (uuid.UUID, error) {
	return parseUUID(request.PathValue(name), name)
}

func parseUUID(raw, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, &badRequestError{msg: "invalid " + name + ": must be a uuid"}
	}
	return id, nil
}

func decodeJSON(writer http.ResponseWriter, request *http.Request, dst any) error {
	dec := json.NewDecoder(request.Body)
	dec.DisallowUnknownFields() // a typo'd field is a 400, not a silently ignored value
	if err := dec.Decode(dst); err != nil {
		return &badRequestError{msg: "invalid request body: " + err.Error()}
	}
	return nil
}

func actionStrings(actions []booking.Action) []string {
	names := make([]string, len(actions))
	for index, action := range actions {
		names[index] = action.String()
	}
	return names
}

// writeJSON is the transport layer's local alias for the shared response helper, so handler
// code reads naturally without importing the shared package everywhere.
func writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	response.JSON(writer, statusCode, payload)
}
