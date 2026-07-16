// Package ops is the operations console's back end: the manual-assignment queue and the
// commands ops runs against it. Per ROADMAP §4.2 it owns NO aggregates — it reads across
// modules and commands them through their contracts (here, booking.Service.Apply). This is
// the P1 launch path (§4.4): a human sees the queue and assigns a technician by hand.
package ops

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrTechnicianNotFound is returned when an assignment names a technician who does not exist.
var ErrTechnicianNotFound = errors.New("ops: technician not found")

// QueueEntry is one booking awaiting assignment, with the context an admin needs to act.
type QueueEntry struct {
	BookingID     uuid.UUID
	State         string
	CustomerName  string
	CustomerPhone string
	ServiceName   string
	City          string
	Line1         string
	ScheduledFor  *time.Time
	QuotedTotal   money.Money
	CreatedAt     time.Time
}

// Candidate is an eligible technician for a booking, with the §5.1 ranking signals.
type Candidate struct {
	TechnicianID      uuid.UUID
	Name              string
	City              string
	AcceptanceRate    float64
	Rating            float64
	MaxConcurrentJobs int32
	ActiveJobs        int32
}

// Technician is one technician's standing for the admin Employees view: status and current load.
type Technician struct {
	TechnicianID      uuid.UUID
	Name              string
	City              string
	IsOnline          bool
	OnLeave           bool
	AcceptanceRate    float64
	Rating            float64
	MaxConcurrentJobs int32
	ActiveJobs        int32
}

// Service is the ops back end. It holds the pool for its cross-module reads and the booking
// service for the one thing it commands: assigning a technician.
type Service struct {
	pool     *pgxpool.Pool
	bookings *booking.Service
}

func New(pool *pgxpool.Pool, bookings *booking.Service) *Service {
	return &Service{pool: pool, bookings: bookings}
}

// Queue returns every booking waiting for a human to assign a technician, oldest first.
func (service *Service) Queue(ctx context.Context) ([]QueueEntry, error) {
	rows, err := sqlcgen.New(service.pool).ListAssignmentQueue(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading assignment queue: %w", err)
	}
	queue := make([]QueueEntry, len(rows))
	for index, row := range rows {
		queue[index] = QueueEntry{
			BookingID:     row.ID,
			State:         row.State,
			CustomerName:  row.CustomerName,
			CustomerPhone: row.CustomerPhone,
			ServiceName:   row.ServiceName,
			City:          row.City,
			Line1:         row.Line1,
			ScheduledFor:  timePointer(row.ScheduledFor),
			QuotedTotal:   row.QuotedTotalPaise,
			CreatedAt:     row.CreatedAt.Time,
		}
	}
	return queue, nil
}

// Candidates returns the technicians eligible for a booking (ROADMAP §5.1), ranked.
func (service *Service) Candidates(ctx context.Context, bookingID uuid.UUID) ([]Candidate, error) {
	rows, err := sqlcgen.New(service.pool).ListCandidateTechnicians(ctx, bookingID)
	if err != nil {
		return nil, fmt.Errorf("reading candidates: %w", err)
	}
	candidates := make([]Candidate, len(rows))
	for index, row := range rows {
		candidates[index] = Candidate{
			TechnicianID:      row.UserID,
			Name:              row.Name,
			City:              row.City,
			AcceptanceRate:    numericToFloat(row.AcceptanceRate),
			Rating:            numericToFloat(row.Rating),
			MaxConcurrentJobs: row.MaxConcurrentJobs,
			ActiveJobs:        row.ActiveJobs,
		}
	}
	return candidates, nil
}

// Technicians returns every technician with their status and current load — the admin's Employees
// view. Unlike Candidates it is not scoped to a booking or filtered by eligibility.
func (service *Service) Technicians(ctx context.Context) ([]Technician, error) {
	rows, err := sqlcgen.New(service.pool).ListTechnicians(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading technicians: %w", err)
	}
	technicians := make([]Technician, len(rows))
	for index, row := range rows {
		technicians[index] = Technician{
			TechnicianID:      row.UserID,
			Name:              row.Name,
			City:              row.City,
			IsOnline:          row.IsOnline,
			OnLeave:           row.OnLeave,
			AcceptanceRate:    numericToFloat(row.AcceptanceRate),
			Rating:            numericToFloat(row.Rating),
			MaxConcurrentJobs: row.MaxConcurrentJobs,
			ActiveJobs:        row.ActiveJobs,
		}
	}
	return technicians, nil
}

// Assign puts a technician on a booking. It verifies the technician exists (a clean 404
// rather than a foreign-key 500), then commands the ASSIGN transition as the admin — which
// runs the full authorization, state-machine, and CAS path in booking.Apply.
func (service *Service) Assign(ctx context.Context, bookingID, technicianID, adminID uuid.UUID) (booking.State, error) {
	exists, err := sqlcgen.New(service.pool).TechnicianExists(ctx, technicianID)
	if err != nil {
		return "", fmt.Errorf("checking technician: %w", err)
	}
	if !exists {
		return "", ErrTechnicianNotFound
	}
	return service.bookings.Apply(ctx, bookingID, booking.ActionAssign, booking.TransitionInput{
		Actor:            &adminID,
		ActorRole:        identity.RoleAdmin,
		AssignTechnician: &technicianID,
	})
}

// StartSearch moves a CONFIRMED booking into SEARCHING, so it appears in the assignment
// queue automatically. It is the auto-search step: an outbox consumer of `booking.confirmed`
// wires main -> this. The system performs it (nil actor) with admin authority, since SEARCH
// is an ops action.
//
// IDEMPOTENCY is the whole point here. Outbox delivery is at-least-once, so this may be
// called again for a booking that has already left CONFIRMED — searched by an admin,
// cancelled, or re-delivered after we already handled it. In every one of those cases the
// booking has correctly moved on and there is nothing to do: we return nil so the outbox
// marks the event published and stops retrying. Only a genuine infrastructure error is worth
// a retry.
func (service *Service) StartSearch(ctx context.Context, bookingID uuid.UUID) error {
	_, err := service.bookings.Apply(ctx, bookingID, booking.ActionSearch, booking.TransitionInput{
		Actor:     nil, // system
		ActorRole: identity.RoleAdmin,
	})
	if err == nil {
		return nil
	}

	// The booking already moved on (illegal from its current state) or someone raced us to
	// it (optimistic-lock conflict). Either way it is no longer ours to search — done.
	var illegal *booking.IllegalTransitionError
	var conflict *booking.ConflictError
	if errors.As(err, &illegal) || errors.As(err, &conflict) || errors.Is(err, booking.ErrBookingNotFound) {
		return nil
	}
	return fmt.Errorf("auto-search booking %s: %w", bookingID, err)
}

func timePointer(timestamp pgtype.Timestamptz) *time.Time {
	if !timestamp.Valid {
		return nil
	}
	return &timestamp.Time
}

func numericToFloat(numeric pgtype.Numeric) float64 {
	value, err := numeric.Float64Value()
	if err != nil || !value.Valid {
		return 0
	}
	return value.Float64
}
