// Package httpapi is the transport layer: it turns HTTP requests into domain-service calls
// and domain results (and errors) back into HTTP. It holds no business rules — those live in
// the domain packages. Keeping transport separate is why the same booking.Service can later
// be driven by a gRPC or a queue consumer without change.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"

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
// P0 scope: creating a booking requires the CUSTOMER role (customers book); reading and
// transitioning require only authentication. Per-action RBAC on transitions (only a
// technician may ARRIVE, only an admin may ASSIGN) is a P1 refinement — the RequireRole
// mechanism it needs already exists and is tested.
func (handler *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /bookings",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleCustomer, http.HandlerFunc(handler.create))))
	mux.Handle("GET /bookings/{id}",
		handler.signer.RequireAuth(http.HandlerFunc(handler.get)))
	mux.Handle("POST /bookings/{id}/transitions",
		handler.signer.RequireAuth(http.HandlerFunc(handler.transition)))
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

func (handler *Handler) create(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.UserFrom(r.Context())
	if !ok {
		writeError(w, handler.log, &badRequestError{msg: "authentication required"})
		return
	}

	var req createRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, handler.log, err)
		return
	}

	created, err := handler.bookings.Create(r.Context(), booking.CreateInput{
		CustomerID: caller.ID, // the booker is the authenticated caller, never a body field
		AddressID:  req.AddressID,
		VariantID:  req.VariantID,
		Quantity:   req.Quantity,
	})
	if err != nil {
		writeError(w, handler.log, err)
		return
	}

	writeJSON(w, http.StatusCreated, bookingResponse{
		BookingID:        created.BookingID,
		OrderID:          created.OrderID,
		State:            created.State.String(),
		QuotedTotalPaise: created.QuotedTotal.Paise(),
		AllowedActions:   actionStrings(booking.AllowedActions(created.State)),
	})
}

// --- GET /bookings/{id} -----------------------------------------------------

func (handler *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, handler.log, err)
		return
	}

	view, err := handler.bookings.Get(r.Context(), id)
	if err != nil {
		writeError(w, handler.log, err)
		return
	}

	writeJSON(w, http.StatusOK, bookingResponse{
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

func (handler *Handler) transition(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, handler.log, err)
		return
	}

	var req transitionRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, handler.log, err)
		return
	}

	action := booking.Action(req.Action)
	if !action.Valid() {
		writeError(w, handler.log, &badRequestError{msg: "unknown action: " + req.Action})
		return
	}

	// The actor is the authenticated caller — attributed to the booking_events row, and
	// forgery-proof, because it comes from the verified token, not a header.
	caller, ok := auth.UserFrom(r.Context())
	if !ok {
		writeError(w, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	actor := caller.ID

	newState, err := handler.bookings.Apply(r.Context(), id, action, booking.TransitionInput{
		Actor:            &actor,
		AssignTechnician: req.Technician,
	})
	if err != nil {
		writeError(w, handler.log, err)
		return
	}

	writeJSON(w, http.StatusOK, bookingResponse{
		BookingID:      id,
		State:          newState.String(),
		AllowedActions: actionStrings(booking.AllowedActions(newState)),
	})
}

// --- helpers ----------------------------------------------------------------

func pathUUID(r *http.Request, name string) (uuid.UUID, error) {
	return parseUUID(r.PathValue(name), name)
}

func parseUUID(raw, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, &badRequestError{msg: "invalid " + name + ": must be a uuid"}
	}
	return id, nil
}

func decodeJSON(_ http.ResponseWriter, r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // a typo'd field is a 400, not a silently ignored value
	if err := dec.Decode(dst); err != nil {
		return &badRequestError{msg: "invalid request body: " + err.Error()}
	}
	return nil
}

func actionStrings(actions []booking.Action) []string {
	out := make([]string, len(actions))
	for i, a := range actions {
		out[i] = a.String()
	}
	return out
}

// writeJSON is the transport layer's local alias for the shared response helper, so handler
// code reads naturally without importing the shared package everywhere.
func writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	response.JSON(writer, statusCode, payload)
}
