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

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
)

// Handler wires the HTTP routes to the domain services.
type Handler struct {
	bookings *booking.Service
	log      *slog.Logger
}

func New(bookings *booking.Service, log *slog.Logger) *Handler {
	return &Handler{bookings: bookings, log: log}
}

// Register mounts the booking endpoints onto mux. Go 1.22+ ServeMux matches method and path
// pattern natively, so {id} is a real path variable read via r.PathValue.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /bookings", h.create)
	mux.HandleFunc("GET /bookings/{id}", h.get)
	mux.HandleFunc("POST /bookings/{id}/transitions", h.transition)
}

// --- POST /bookings ---------------------------------------------------------

type createRequest struct {
	CustomerID uuid.UUID `json:"customer_id"`
	AddressID  uuid.UUID `json:"address_id"`
	VariantID  uuid.UUID `json:"variant_id"`
	Quantity   int32     `json:"quantity"`
}

type bookingResponse struct {
	BookingID        uuid.UUID `json:"booking_id"`
	OrderID          uuid.UUID `json:"order_id,omitempty"`
	State            string    `json:"state"`
	QuotedTotalPaise int64     `json:"quoted_total_paise"`
	AllowedActions   []string  `json:"allowed_actions,omitempty"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}

	created, err := h.bookings.Create(r.Context(), booking.CreateInput{
		CustomerID: req.CustomerID,
		AddressID:  req.AddressID,
		VariantID:  req.VariantID,
		Quantity:   req.Quantity,
	})
	if err != nil {
		writeError(w, h.log, err)
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

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	view, err := h.bookings.Get(r.Context(), id)
	if err != nil {
		writeError(w, h.log, err)
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

func (h *Handler) transition(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	var req transitionRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}

	action := booking.Action(req.Action)
	if !action.Valid() {
		writeError(w, h.log, &badRequestError{msg: "unknown action: " + req.Action})
		return
	}

	// Actor comes from a dev header until Task 6 wires real auth. A transition SHOULD be
	// attributed to who performed it; for now it is optional and unauthenticated. This is
	// noted so nobody mistakes it for a finished authorization story.
	actor := actorFromHeader(r)

	newState, err := h.bookings.Apply(r.Context(), id, action, booking.TransitionInput{
		Actor:            actor,
		AssignTechnician: req.Technician,
	})
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	writeJSON(w, http.StatusOK, bookingResponse{
		BookingID:      id,
		State:          newState.String(),
		AllowedActions: actionStrings(booking.AllowedActions(newState)),
	})
}

// --- helpers ----------------------------------------------------------------

func actorFromHeader(r *http.Request) *uuid.UUID {
	raw := r.Header.Get("X-Actor-Id")
	if raw == "" {
		return nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil // a malformed actor header is treated as no actor, not an error
	}
	return &id
}

func pathUUID(r *http.Request, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(r.PathValue(name))
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

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Default().Error("writing json response", "err", err)
	}
}
