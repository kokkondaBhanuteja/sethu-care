// Package order owns the PURCHASE.
//
// An order is what the customer bought and paid for — ONE payment. It fans out into one
// booking per technician VISIT. These are genuinely different things, and conflating them
// was the original design error: an AC service and a geyser repair need different skills,
// so they are two technicians and two arrivals, and no single booking state machine can
// honestly describe "half arrived".
//
// This exists in P0 rather than P3 because of AUDIT. One ₹1,399 payment fanning out to two
// bookings, with no parent entity, must either invent an allocation across them or staple
// the whole amount to one and show the other as ₹0 — and both are lies in an append-only
// ledger. You can add a table later; you cannot go back and re-attach ledger rows written
// against the wrong entity.
//
// Per ROADMAP §4.6 this is a SEAM, not a feature: in P0/P1 an order has exactly one
// booking, enforced by a unique index that P3 drops.
package order

import "fmt"

// Status is where a purchase stands. Not to be confused with booking.State — this tracks
// the MONEY, not the work.
type Status string

const (
	StatusPending   Status = "PENDING"
	StatusPaid      Status = "PAID"
	StatusRefunded  Status = "REFUNDED"
	StatusCancelled Status = "CANCELLED"
)

func AllStatuses() []Status {
	return []Status{StatusPending, StatusPaid, StatusRefunded, StatusCancelled}
}

func (status Status) Valid() bool {
	switch status {
	case StatusPending, StatusPaid, StatusRefunded, StatusCancelled:
		return true
	}
	return false
}

func (status Status) String() string { return string(status) }

func ParseStatus(raw string) (Status, error) {
	status := Status(raw)
	if !status.Valid() {
		return "", fmt.Errorf("order: unknown status %q", raw)
	}
	return status, nil
}
