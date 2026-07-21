package verification

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

const (
	otpTTL         = 10 * time.Minute
	otpMaxAttempts = 5
	otpDigits      = 6
)

var (
	// ErrOtpInvalid — no live challenge, or the wrong code. One error for both, so a caller
	// cannot distinguish "no OTP issued" from "wrong code".
	ErrOtpInvalid = errors.New("verification: invalid or expired code")
	// ErrOtpTooManyAttempts — the code was guessed at too many times and is now burned.
	ErrOtpTooManyAttempts = errors.New("verification: too many attempts; request a new code")
)

// Service issues and verifies the dual-OTP codes that gate a job's start and completion.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// IssueOTP creates a code for a booking and purpose (START or COMPLETION) and returns the
// PLAINTEXT plus whether a NEW code was issued. Only the bcrypt hash is stored. The plaintext
// is delivered to the customer's phone (dev logs it); the technician reads it back to verify.
//
// IDEMPOTENT: it is driven by the at-least-once outbox, so a redelivered technician.arrived
// must not mint a second code — that would silently invalidate the one the customer already
// has (the verifier takes the newest). If a live challenge already exists, this is a no-op
// that returns issued=false.
func (service *Service) IssueOTP(ctx context.Context, bookingID uuid.UUID, purpose Purpose) (code string, issued bool, err error) {
	if !purpose.RequiresBooking() {
		return "", false, fmt.Errorf("verification: %s is not a job OTP purpose", purpose)
	}
	queries := sqlcgen.New(service.pool)
	bookingRef := bookingID

	// Already issued and still live? Do nothing (redelivery).
	_, err = queries.GetLiveJobOtpChallenge(ctx, sqlcgen.GetLiveJobOtpChallengeParams{
		BookingID: &bookingRef, Purpose: string(purpose),
	})
	if err == nil {
		return "", false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, fmt.Errorf("checking existing otp: %w", err)
	}

	phone, err := queries.GetBookingCustomerPhone(ctx, bookingID)
	if err != nil {
		return "", false, fmt.Errorf("finding customer phone: %w", err)
	}

	code, err = randomCode(otpDigits)
	if err != nil {
		return "", false, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return "", false, fmt.Errorf("hashing otp: %w", err)
	}

	if _, err := queries.InsertJobOtpChallenge(ctx, sqlcgen.InsertJobOtpChallengeParams{
		Purpose:     string(purpose),
		BookingID:   &bookingRef,
		Phone:       phone,
		CodeHash:    string(hash),
		ExpiresAt:   pgtype.Timestamptz{Time: time.Now().Add(otpTTL), Valid: true},
		MaxAttempts: otpMaxAttempts,
	}); err != nil {
		return "", false, fmt.Errorf("storing otp: %w", err)
	}
	return code, true, nil
}

// Guard returns a function that verifies-and-consumes the OTP for a booking and purpose,
// INSIDE a transaction the caller provides. booking.Apply runs it in the same transaction as
// the state change, so a wrong code (or an exhausted one) rolls the whole thing back: the OTP
// is not consumed and the booking does not advance. Atomicity is the point — you can never
// spend an OTP without advancing, or advance without a valid OTP.
func (service *Service) Guard(bookingID uuid.UUID, purpose Purpose, code string) func(context.Context, pgx.Tx) error {
	return func(ctx context.Context, tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		challenge, err := queries.GetLiveJobOtpChallenge(ctx, sqlcgen.GetLiveJobOtpChallengeParams{
			BookingID: &bookingID,
			Purpose:   string(purpose),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrOtpInvalid // no live challenge — never issued or expired
		}
		if err != nil {
			return fmt.Errorf("reading otp: %w", err)
		}

		if challenge.Attempts >= challenge.MaxAttempts {
			if err := queries.ConsumeOtpChallenge(ctx, challenge.ID); err != nil {
				return fmt.Errorf("consuming exhausted otp: %w", err)
			}
			return ErrOtpTooManyAttempts
		}

		if bcrypt.CompareHashAndPassword([]byte(challenge.CodeHash), []byte(code)) != nil {
			if err := queries.IncrementOtpAttempts(ctx, challenge.ID); err != nil {
				return fmt.Errorf("recording failed attempt: %w", err)
			}
			return ErrOtpInvalid
		}

		// Correct. Consume it so the same code can never be replayed.
		if err := queries.ConsumeOtpChallenge(ctx, challenge.ID); err != nil {
			return fmt.Errorf("consuming otp: %w", err)
		}
		return nil
	}
}

// randomCode returns an n-digit numeric code using crypto/rand (predictable math/rand would
// make codes guessable).
func randomCode(length int) (string, error) {
	const digits = "0123456789"
	buffer := make([]byte, length)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generating otp: %w", err)
	}
	for index := range buffer {
		buffer[index] = digits[int(buffer[index])%len(digits)]
	}
	return string(buffer), nil
}
