// Package notifications is the customer-facing voice of the system. It consumes domain
// events off the outbox and, for the ones a customer should hear about, records and sends a
// message. Every send is logged to notification_log (append-only) so there is a durable
// record of what the customer was told.
package notifications

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// Channel is how a message reaches the customer.
type Channel string

const (
	ChannelSMS  Channel = "SMS"
	ChannelPush Channel = "PUSH"
)

// Service records and (in dev, logs) customer notifications.
type Service struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewService(pool *pgxpool.Pool, log *slog.Logger) *Service {
	return &Service{pool: pool, log: log}
}

// Notify sends the customer the message for a booking event, if that event has one. It is an
// outbox consumer, so it is IDEMPOTENT: the (booking_id, event_type) unique index means a
// redelivered event records and sends nothing.
//
// Events without a customer-facing message (booking.created, booking.confirmed's internal
// SEARCH, etc.) are skipped — Notify returns nil so the outbox marks them handled.
func (service *Service) Notify(ctx context.Context, eventType string, bookingID uuid.UUID) error {
	body, ok := messageFor(eventType)
	if !ok {
		return nil // nothing to say for this event
	}

	recipient, err := sqlcgen.New(service.pool).GetNotificationRecipient(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("finding notification recipient: %w", err)
	}

	bookingRef := bookingID
	inserted, err := sqlcgen.New(service.pool).InsertNotification(ctx, sqlcgen.InsertNotificationParams{
		RecipientID: recipient.ID,
		Channel:     string(ChannelSMS),
		EventType:   eventType,
		BookingID:   &bookingRef,
		Body:        body,
	})
	if err != nil {
		return fmt.Errorf("recording notification: %w", err)
	}
	if inserted == 0 {
		return nil // already sent (redelivery)
	}

	// In production this hands off to the SMS provider. In dev, the log IS the delivery.
	service.log.Info("notification sent",
		"channel", ChannelSMS, "to", recipient.Phone, "event", eventType, "body", body)
	return nil
}

// messageFor is the template for each customer-facing event. Events not listed here produce
// no notification. Kept deliberately simple (no per-booking interpolation yet) — the point is
// the pipeline, not the copy.
func messageFor(eventType string) (string, bool) {
	switch eventType {
	case "booking.assigned":
		return "A technician has been assigned to your booking.", true
	case "technician.en_route":
		return "Your technician is on the way.", true
	case "technician.arrived":
		return "Your technician has arrived. Share the start code to begin.", true
	case "booking.started":
		return "Your service has started.", true
	case "booking.completed":
		return "Your service is complete. Thank you for choosing SETHU-CARE!", true
	case "booking.escalated":
		return "We're personally arranging a technician for you — we'll confirm shortly.", true
	case "booking.failed":
		return "We're sorry — we couldn't find a technician. A credit has been added to your account.", true
	case "booking.cancelled":
		return "Your booking has been cancelled.", true
	case "booking.rescheduled":
		return "Your booking has been rescheduled.", true
	default:
		return "", false
	}
}
