// Package rescue is the write side of the admin console's booking rescue: manual assign
// support, emergency cancel, redispatch, admin-verified manual completion, refund, and the
// compensating undos. Like ops it owns NO aggregate — every state change commands
// booking.Apply (the full authorization + state-machine + CAS path), every rupee goes
// through the ledger service, and every mutation is audited and idempotent under the
// operator's Idempotency-Key.
package rescue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// The server-stated policy the console renders and this service enforces. The console
// mirrors these for UX only; the server is the authority (admin spec §6.14/§6.27).
const (
	// GoodwillCapPaise is the most a goodwill credit may move — ₹500.
	GoodwillCapPaise int64 = 50_000
	// IncentiveCapPaise bounds a redispatch incentive — ₹750.
	IncentiveCapPaise int64 = 75_000
	// DefaultIncentivePaise is the recommended (not default) redispatch spend — ₹150.
	DefaultIncentivePaise int64 = 15_000
	// RefundsAllowedPerHour is each admin's refund budget per rolling hour.
	RefundsAllowedPerHour int32 = 10

	// UndoAssignWindow and UndoCancelWindow are the §10.3 risk-register undo windows.
	UndoAssignWindow = 30 * time.Second
	UndoCancelWindow = 10 * time.Second

	// ManualCompletionLock is how long after the technician reported the work an admin must
	// wait before asserting a completion the customer's OTP never proved.
	ManualCompletionLock = 30 * time.Minute
	// manualCompletionNoteMinLength is the server-enforced note floor.
	manualCompletionNoteMinLength = 20
)

// Radius is a redispatch search-widening step. Values mirror the console vocabulary.
type Radius string

const (
	RadiusBase     Radius = "base"
	RadiusPlus50   Radius = "plus_50"
	RadiusPlus100  Radius = "plus_100"
	RadiusCityWide Radius = "city_wide"
)

// KmOf is the nominal search radius each step widens to, anchored on the 10 km default
// technician service radius (technicians.service_radius_metres).
func (radius Radius) KmOf() float64 {
	switch radius {
	case RadiusBase:
		return 10
	case RadiusPlus50:
		return 15
	case RadiusPlus100:
		return 20
	case RadiusCityWide:
		return 30
	}
	return 10
}

// nextRadius is the widening step after this one; city-wide has nowhere further to go.
func (radius Radius) nextRadius() Radius {
	switch radius {
	case RadiusBase:
		return RadiusPlus50
	case RadiusPlus50:
		return RadiusPlus100
	case RadiusPlus100, RadiusCityWide:
		return RadiusCityWide
	}
	return RadiusPlus50
}

// Service is the rescue console's back end. It holds the pool for its read models, and the
// owning services for everything it commands: booking (transitions), ledger (money), audit
// (the trail and the idempotent-replay store).
type Service struct {
	pool     *pgxpool.Pool
	bookings *booking.Service
	ledger   *ledger.Service
	trail    *audit.Service
}

// New builds the rescue service.
func New(pool *pgxpool.Pool, bookings *booking.Service, ledgerService *ledger.Service, trail *audit.Service) *Service {
	return &Service{pool: pool, bookings: bookings, ledger: ledgerService, trail: trail}
}

// Subject is the record header every action screen restates.
type Subject struct {
	BookingID    uuid.UUID
	OrderID      uuid.UUID
	State        booking.State
	Version      int64
	Amount       money.Money
	CreatedAt    time.Time
	CustomerName string
	ProviderName *string
	TechnicianID *uuid.UUID
	ServiceName  string
	Zone         string
	// PaymentMethod is the recorded method code (UPI/CASH/ONLINE), or "" while no payment
	// record exists — most in-flight bookings.
	PaymentMethod string
	// EscalatedMinutes is non-nil only while the booking sits in ESCALATED.
	EscalatedMinutes *int32
}

// record is everything the context and action methods work from: the full admin detail
// (with its transition timeline) plus the money side's payment facts.
type record struct {
	subject Subject
	detail  booking.AdminDetail
	facts   ledger.PaymentFacts
}

// loadRecord composes the booking's admin detail with the ledger's payment facts — the
// same two-service composition the phase-1 detail endpoint made, since booking (a core)
// must not read ledger tables.
func (service *Service) loadRecord(ctx context.Context, bookingID uuid.UUID) (record, error) {
	detail, err := service.bookings.AdminDetailByID(ctx, bookingID)
	if err != nil {
		return record{}, err
	}
	facts, err := service.ledger.PaymentFactsForBooking(ctx, detail.BookingID, detail.OrderID)
	if err != nil {
		return record{}, err
	}

	subject := Subject{
		BookingID:    detail.BookingID,
		OrderID:      detail.OrderID,
		State:        detail.State,
		Version:      detail.Version,
		Amount:       detail.Amount,
		CreatedAt:    detail.CreatedAt,
		CustomerName: detail.CustomerName,
		ProviderName: detail.TechnicianName,
		TechnicianID: detail.TechnicianID,
		ServiceName:  detail.ServiceName,
		Zone:         detail.City,
	}
	if facts.Found {
		subject.PaymentMethod = facts.Method.String()
	}
	if detail.State == booking.StateEscalated {
		since := detail.CreatedAt
		if escalatedAt := lastActionAt(detail.Timeline, booking.ActionEscalate); escalatedAt != nil {
			since = *escalatedAt
		}
		minutes := minutesSince(since)
		subject.EscalatedMinutes = &minutes
	}
	return record{subject: subject, detail: detail, facts: facts}, nil
}

// lastActionAt is when the most recent occurrence of an action landed, or nil if it never
// happened. The timeline is oldest-first, so the last match wins.
func lastActionAt(timeline []booking.AdminTimelineEntry, action booking.Action) *time.Time {
	var found *time.Time
	for index := range timeline {
		if timeline[index].Action == action {
			at := timeline[index].At
			found = &at
		}
	}
	return found
}

func countAction(timeline []booking.AdminTimelineEntry, action booking.Action) int32 {
	var total int32
	for index := range timeline {
		if timeline[index].Action == action {
			total++
		}
	}
	return total
}

func minutesSince(since time.Time) int32 {
	minutes := int32(time.Since(since).Minutes())
	if minutes < 0 {
		return 0
	}
	return minutes
}

// requireVersion enforces the console's optimistic-concurrency echo: the submitted version
// must be the record's current one.
func requireVersion(detail booking.AdminDetail, submitted int32) error {
	if int64(submitted) != detail.Version {
		return &StaleVersionError{CurrentVersion: int32(detail.Version)}
	}
	return nil
}

// paidAmount is the money that actually moved for this booking — a pending collection is
// never counted as paid.
func paidAmount(facts ledger.PaymentFacts) money.Money {
	if facts.Found && facts.PaidAt != nil {
		return facts.Amount
	}
	return money.FromPaise(0)
}

// refundableFor computes what could still be refunded: what was paid, minus the credits
// already standing against the order.
func (service *Service) refundableFor(ctx context.Context, rec record) (refundable, alreadyRefunded money.Money, err error) {
	position, err := service.ledger.CreditPositionForOrder(ctx, rec.detail.OrderID)
	if err != nil {
		return money.FromPaise(0), money.FromPaise(0), err
	}
	alreadyRefunded = position.Outstanding()
	remaining := paidAmount(rec.facts).Paise() - alreadyRefunded.Paise()
	if remaining < 0 {
		remaining = 0
	}
	return money.FromPaise(remaining), alreadyRefunded, nil
}

// replayInto returns true when this Idempotency-Key was already executed, decoding the
// stored first receipt into `into`.
func (service *Service) replayInto(ctx context.Context, operation string, bookingID uuid.UUID, idempotencyKey string, into any) (uuid.UUID, bool, error) {
	keyID := audit.ActionKeyID(operation, bookingID.String(), idempotencyKey)
	raw, found, err := service.trail.ReplayAdminAction(ctx, keyID)
	if err != nil {
		return keyID, false, err
	}
	if !found {
		return keyID, false, nil
	}
	if err := audit.UnmarshalReceipt(raw, into); err != nil {
		return keyID, false, err
	}
	return keyID, true, nil
}

// marshalMeta builds the booking_events meta object a rescue transition records.
func marshalMeta(payload any) ([]byte, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("rescue: marshalling event meta: %w", err)
	}
	return raw, nil
}
