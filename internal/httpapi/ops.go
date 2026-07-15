package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
)

// OpsHandler serves the operations console. Every route is ADMIN-only.
type OpsHandler struct {
	ops    *ops.Service
	signer *auth.Signer
	log    *slog.Logger
}

func NewOpsHandler(opsService *ops.Service, signer *auth.Signer, log *slog.Logger) *OpsHandler {
	return &OpsHandler{ops: opsService, signer: signer, log: log}
}

func (handler *OpsHandler) Register(mux *http.ServeMux) {
	adminOnly := func(fn http.HandlerFunc) http.Handler {
		return handler.signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, fn))
	}
	mux.Handle("GET /ops/assignment-queue", adminOnly(handler.queue))
	mux.Handle("GET /ops/bookings/{id}/candidates", adminOnly(handler.candidates))
	mux.Handle("POST /ops/bookings/{id}/assign", adminOnly(handler.assign))
}

type queueEntryResponse struct {
	BookingID     string     `json:"booking_id"`
	State         string     `json:"state"`
	CustomerName  string     `json:"customer_name"`
	CustomerPhone string     `json:"customer_phone"`
	ServiceName   string     `json:"service_name"`
	City          string     `json:"city"`
	Line1         string     `json:"line1"`
	ScheduledFor  *time.Time `json:"scheduled_for,omitempty"`
	QuotedTotal   string     `json:"quoted_total"`
	CreatedAt     time.Time  `json:"created_at"`
}

func (handler *OpsHandler) queue(writer http.ResponseWriter, request *http.Request) {
	entries, err := handler.ops.Queue(request.Context())
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]queueEntryResponse, len(entries))
	for index, entry := range entries {
		payload[index] = queueEntryResponse{
			BookingID:     entry.BookingID.String(),
			State:         entry.State,
			CustomerName:  entry.CustomerName,
			CustomerPhone: entry.CustomerPhone,
			ServiceName:   entry.ServiceName,
			City:          entry.City,
			Line1:         entry.Line1,
			ScheduledFor:  entry.ScheduledFor,
			QuotedTotal:   entry.QuotedTotal.Rupees(),
			CreatedAt:     entry.CreatedAt,
		}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"queue": payload})
}

type candidateResponse struct {
	TechnicianID      string  `json:"technician_id"`
	Name              string  `json:"name"`
	City              string  `json:"city"`
	AcceptanceRate    float64 `json:"acceptance_rate"`
	Rating            float64 `json:"rating"`
	MaxConcurrentJobs int32   `json:"max_concurrent_jobs"`
	ActiveJobs        int32   `json:"active_jobs"`
}

func (handler *OpsHandler) candidates(writer http.ResponseWriter, request *http.Request) {
	bookingID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	found, err := handler.ops.Candidates(request.Context(), bookingID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]candidateResponse, len(found))
	for index, candidate := range found {
		payload[index] = candidateResponse{
			TechnicianID:      candidate.TechnicianID.String(),
			Name:              candidate.Name,
			City:              candidate.City,
			AcceptanceRate:    candidate.AcceptanceRate,
			Rating:            candidate.Rating,
			MaxConcurrentJobs: candidate.MaxConcurrentJobs,
			ActiveJobs:        candidate.ActiveJobs,
		}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"candidates": payload})
}

type assignRequest struct {
	TechnicianID uuid.UUID `json:"technician_id"`
}

func (handler *OpsHandler) assign(writer http.ResponseWriter, request *http.Request) {
	bookingID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	admin, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}

	var req assignRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}

	newState, err := handler.ops.Assign(request.Context(), bookingID, req.TechnicianID, admin.ID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{
		"booking_id": bookingID.String(),
		"state":      newState.String(),
	})
}
