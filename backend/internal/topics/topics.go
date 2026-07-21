// Package topics is the registry of outbox event names — the contract between the PUBLISHER of a
// domain event (booking, reviews) and its CONSUMERS (the app wiring, notifications). The event name
// is the entire coupling: publisher and consumer agree only by using the SAME string. Defining each
// once here, as a typed constant, turns a typo into a compile error instead of a silently dropped
// event (the classic failure of stringly-typed pub/sub).
//
// This is a pure leaf: it imports nothing internal and is safe for any package to import. Names are
// the ROADMAP §8 event catalogue.
package topics

// EventName is an outbox event/topic name, e.g. "booking.completed".
type EventName string

const (
	// Booking lifecycle (published by internal/booking as transitions apply).
	BookingCreated            EventName = "booking.created"
	BookingConfirmed          EventName = "booking.confirmed"
	BookingAssigned           EventName = "booking.assigned"
	TechnicianEnRoute         EventName = "technician.en_route"
	TechnicianArrived         EventName = "technician.arrived"
	BookingStarted            EventName = "booking.started"
	BookingAwaitingCompletion EventName = "booking.awaiting_completion"
	BookingCompleted          EventName = "booking.completed"
	BookingEscalated          EventName = "booking.escalated"
	BookingFailed             EventName = "booking.failed"
	BookingCancelled          EventName = "booking.cancelled"
	BookingRescheduled        EventName = "booking.rescheduled"

	// Reviews (published by internal/reviews on submit).
	ReviewSubmitted EventName = "review.submitted"
)

// All lists every registered event name, in publish order. Useful for tests that assert the
// publisher and consumers only traffic in known topics.
func All() []EventName {
	return []EventName{
		BookingCreated, BookingConfirmed, BookingAssigned, TechnicianEnRoute,
		TechnicianArrived, BookingStarted, BookingAwaitingCompletion, BookingCompleted,
		BookingEscalated, BookingFailed, BookingCancelled, BookingRescheduled,
		ReviewSubmitted,
	}
}

// String returns the wire value, for the string-typed outbox APIs (Event.EventType, Subscribe).
func (name EventName) String() string { return string(name) }
