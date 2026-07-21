// Package sms delivers one-time codes over SMS. It is a LEAF: it imports nothing from the domain,
// so any package (login, job-code issuance) can be handed a Sender without creating an inward
// dependency. LogSender is the dev default (the log is the delivery); MSG91 (msg91.go) is the real
// provider.
package sms

import (
	"context"
	"log/slog"
)

// Sender delivers a numeric OTP to a phone. One method, one job: the caller never knows which
// provider is behind the port.
type Sender interface {
	SendOTP(ctx context.Context, phone, code string) error
}

// LogSender is the development Sender — the log IS the delivery. NEVER use it in production: it
// prints live login codes.
type LogSender struct {
	log *slog.Logger
}

func NewLogSender(log *slog.Logger) *LogSender {
	return &LogSender{log: log}
}

func (sender *LogSender) SendOTP(_ context.Context, phone, code string) error {
	sender.log.Info("SMS OTP (dev — not actually sent)", "to", phone, "code", code)
	return nil
}
