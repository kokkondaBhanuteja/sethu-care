package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
)

// OpsHandler serves the operations console. Every operation is ADMIN-only.
type OpsHandler struct {
	ops *ops.Service
	log *slog.Logger
}

func NewOpsHandler(opsService *ops.Service, log *slog.Logger) *OpsHandler {
	return &OpsHandler{ops: opsService, log: log}
}

func (handler *OpsHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "assignmentQueue", Method: http.MethodGet, Path: "/ops/assignment-queue",
		Summary: "List the assignment queue", Tags: []string{"Ops"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.queue)
	huma.Register(api, huma.Operation{
		OperationID: "bookingCandidates", Method: http.MethodGet, Path: "/ops/bookings/{id}/candidates",
		Summary: "List eligible technicians for a booking", Tags: []string{"Ops"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.candidates)
	huma.Register(api, huma.Operation{
		OperationID: "assignBooking", Method: http.MethodPost, Path: "/ops/bookings/{id}/assign",
		Summary: "Assign a technician to a booking", Tags: []string{"Ops"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.assign)
	huma.Register(api, huma.Operation{
		OperationID: "listTechnicians", Method: http.MethodGet, Path: "/ops/technicians",
		Summary: "List technicians and their load", Tags: []string{"Ops"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.technicians)
}

type technicianResponse struct {
	TechnicianID      string  `json:"technician_id"`
	Name              string  `json:"name"`
	City              string  `json:"city"`
	IsOnline          bool    `json:"is_online"`
	OnLeave           bool    `json:"on_leave"`
	AcceptanceRate    float64 `json:"acceptance_rate"`
	Rating            float64 `json:"rating"`
	MaxConcurrentJobs int32   `json:"max_concurrent_jobs"`
	ActiveJobs        int32   `json:"active_jobs"`
}

type techniciansOutput struct {
	Body struct {
		Technicians []technicianResponse `json:"technicians"`
	}
}

func (handler *OpsHandler) technicians(ctx context.Context, _ *struct{}) (*techniciansOutput, error) {
	found, err := handler.ops.Technicians(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &techniciansOutput{}
	out.Body.Technicians = make([]technicianResponse, len(found))
	for index, technician := range found {
		out.Body.Technicians[index] = technicianResponse{
			TechnicianID:      technician.TechnicianID.String(),
			Name:              technician.Name,
			City:              technician.City,
			IsOnline:          technician.IsOnline,
			OnLeave:           technician.OnLeave,
			AcceptanceRate:    technician.AcceptanceRate,
			Rating:            technician.Rating,
			MaxConcurrentJobs: technician.MaxConcurrentJobs,
			ActiveJobs:        technician.ActiveJobs,
		}
	}
	return out, nil
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

type queueOutput struct {
	Body struct {
		Queue []queueEntryResponse `json:"queue"`
	}
}

func (handler *OpsHandler) queue(ctx context.Context, _ *struct{}) (*queueOutput, error) {
	entries, err := handler.ops.Queue(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &queueOutput{}
	out.Body.Queue = make([]queueEntryResponse, len(entries))
	for index, entry := range entries {
		out.Body.Queue[index] = queueEntryResponse{
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
	return out, nil
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

type bookingIDInput struct {
	ID string `path:"id" format:"uuid" doc:"Booking id"`
}

type candidatesOutput struct {
	Body struct {
		Candidates []candidateResponse `json:"candidates"`
	}
}

func (handler *OpsHandler) candidates(ctx context.Context, input *bookingIDInput) (*candidatesOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	found, err := handler.ops.Candidates(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &candidatesOutput{}
	out.Body.Candidates = make([]candidateResponse, len(found))
	for index, candidate := range found {
		out.Body.Candidates[index] = candidateResponse{
			TechnicianID:      candidate.TechnicianID.String(),
			Name:              candidate.Name,
			City:              candidate.City,
			AcceptanceRate:    candidate.AcceptanceRate,
			Rating:            candidate.Rating,
			MaxConcurrentJobs: candidate.MaxConcurrentJobs,
			ActiveJobs:        candidate.ActiveJobs,
		}
	}
	return out, nil
}

type assignRequest struct {
	TechnicianID uuid.UUID `json:"technician_id"`
}

type assignInput struct {
	ID   string `path:"id" format:"uuid" doc:"Booking id"`
	Body assignRequest
}

type assignOutput struct {
	Body struct {
		BookingID string `json:"booking_id"`
		State     string `json:"state"`
	}
}

func (handler *OpsHandler) assign(ctx context.Context, input *assignInput) (*assignOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	newState, err := handler.ops.Assign(ctx, bookingID, input.Body.TechnicianID, admin.ID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &assignOutput{}
	out.Body.BookingID = bookingID.String()
	out.Body.State = newState.String()
	return out, nil
}
