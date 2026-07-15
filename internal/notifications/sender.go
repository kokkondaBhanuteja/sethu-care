package notifications

import (
	"context"
	"log/slog"
)

// Outbound is one message handed to a delivery provider: which channel, who it is for (a phone
// for SMS, a device token for push), and the body. It is deliberately provider-agnostic — the
// Sender behind the port decides how it physically leaves the system.
type Outbound struct {
	Channel   Channel
	Recipient string
	EventType string
	Body      string
}

// Sender is the delivery port. The notifications service records what to say; the Sender is the
// seam where a real provider (MSG91 for SMS, Firebase for push) plugs in. Keeping it an
// interface means the service, and its tests, never depend on a live provider.
type Sender interface {
	Send(ctx context.Context, message Outbound) error
}

// LogSender is the default Sender: in dev, the log IS the delivery. It is also what tests use,
// so a test can assert a message was dispatched without standing up an SMS gateway.
type LogSender struct {
	log *slog.Logger
}

func NewLogSender(log *slog.Logger) *LogSender {
	return &LogSender{log: log}
}

func (sender *LogSender) Send(ctx context.Context, message Outbound) error {
	sender.log.Info("notification dispatched",
		"channel", message.Channel,
		"to", message.Recipient,
		"event", message.EventType,
		"body", message.Body)
	return nil
}
