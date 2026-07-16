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

	"github.com/kokkondaBhanuteja/sethu-care/internal/sms"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// Channel is how a message reaches the customer.
type Channel string

const (
	ChannelSMS  Channel = "SMS"
	ChannelPush Channel = "PUSH"
)

// Service records customer notifications and hands them to a Sender for delivery. It owns the
// durable record (notification_log); the Sender owns the wire.
type Service struct {
	pool   *pgxpool.Pool
	sender Sender
	otp    sms.Sender // optional: dedicated OTP transport (e.g. MSG91's DLT template)
	log    *slog.Logger
}

// Option configures the Service at construction.
type Option func(*Service)

// WithOTPSender routes job start/completion codes through a dedicated OTP transport (MSG91's
// approved template) instead of the generic notification Sender. Without it, job codes fall back
// to the generic Sender (dev/logging).
func WithOTPSender(sender sms.Sender) Option {
	return func(service *Service) { service.otp = sender }
}

func NewService(pool *pgxpool.Pool, sender Sender, log *slog.Logger, opts ...Option) *Service {
	service := &Service{pool: pool, sender: sender, log: log}
	for _, opt := range opts {
		opt(service)
	}
	return service
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

	// The row is committed; now hand it to the delivery port. A Send failure returns an error
	// so the outbox retries — at-least-once, matching every other consumer.
	return service.sender.Send(ctx, Outbound{
		Channel:   ChannelSMS,
		Recipient: recipient.Phone,
		EventType: eventType,
		Body:      body,
	})
}

// SendJobCode delivers a freshly issued job OTP (the START or COMPLETION code) to the booking's
// customer, who then reads it aloud to the technician. It goes straight through the delivery
// port and is deliberately NOT written to notification_log: persisting a plaintext OTP would
// turn the audit log into a credential store. Idempotency is upstream — the caller only issues
// (and so only sends) a code once per live challenge.
func (service *Service) SendJobCode(ctx context.Context, bookingID uuid.UUID, purpose, code string) error {
	recipient, err := sqlcgen.New(service.pool).GetNotificationRecipient(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("finding otp recipient: %w", err)
	}
	// A dedicated OTP transport (MSG91) owns the message text via its approved template, so it takes
	// only the code. Without one, fall back to the generic Sender with our own copy (dev/logging).
	if service.otp != nil {
		return service.otp.SendOTP(ctx, recipient.Phone, code)
	}
	return service.sender.Send(ctx, Outbound{
		Channel:   ChannelSMS,
		Recipient: recipient.Phone,
		EventType: "otp." + purpose,
		Body:      codeMessage(purpose, code),
	})
}

// codeMessage is the SMS copy for a job OTP. START begins the work; COMPLETION closes it out.
func codeMessage(purpose, code string) string {
	switch purpose {
	case "COMPLETION":
		return fmt.Sprintf("Your SETHU-CARE completion code is %s. Share it with your technician once the work is done.", code)
	default:
		return fmt.Sprintf("Your SETHU-CARE start code is %s. Share it with your technician to begin.", code)
	}
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
		return "Your technician has arrived. We've texted you a start code to share with them.", true
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
