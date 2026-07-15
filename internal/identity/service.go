package identity

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

// OTP tuning. These are the security envelope: how long a code lives, how many guesses it
// gets, and how often a phone may ask for a new one.
const (
	otpTTL         = 5 * time.Minute
	otpMaxAttempts = 5
	otpResendGuard = 30 // seconds; a second request inside this window is refused
	otpDigits      = 6
)

var (
	// ErrOtpRateLimited — asked for a new code too soon. A 429.
	ErrOtpRateLimited = errors.New("identity: otp requested too recently; wait before retrying")
	// ErrOtpInvalid — no live challenge, wrong code, or expired. Deliberately one error for
	// all three, so a caller cannot tell a wrong code from an unknown phone.
	ErrOtpInvalid = errors.New("identity: invalid or expired code")
	// ErrOtpTooManyAttempts — the code was guessed at too many times and is now burned.
	ErrOtpTooManyAttempts = errors.New("identity: too many attempts; request a new code")
)

// User is a person who can authenticate. The public shape of the identity aggregate.
type User struct {
	ID    uuid.UUID
	Phone string
	Name  string
	Role  Role
}

// Service owns users and the OTP challenges that authenticate them.
type Service struct {
	pool      *pgxpool.Pool
	demoPhone string // App Review bypass; empty = disabled
	demoCode  string
}

// Option configures the Service at construction.
type Option func(*Service)

// WithDemoAccount enables a FIXED bypass code for ONE reserved phone number. App Store review
// cannot receive a real SMS OTP (Guideline 2.1a), so the reviewer logs in with this number and a
// static code. The reserved phone should be pre-provisioned with the role under review (a
// technician for the provider app). Never set this for a real user's number.
func WithDemoAccount(phone, code string) Option {
	return func(service *Service) {
		service.demoPhone = phone
		service.demoCode = code
	}
}

func NewService(pool *pgxpool.Pool, opts ...Option) *Service {
	service := &Service{pool: pool}
	for _, opt := range opts {
		opt(service)
	}
	return service
}

// isDemo reports whether this phone is the reserved App-Review bypass number.
func (service *Service) isDemo(phone string) bool {
	return service.demoPhone != "" && phone == service.demoPhone
}

// RequestOTP issues a login code for a phone and returns the PLAINTEXT code.
//
// The plaintext is returned to the CALLER (the service), never stored — only its bcrypt hash
// goes to the database. In dev the HTTP layer logs it; in production it is sent by SMS and
// never appears in a response or a log. This split is why the code lives in a return value
// and not in the struct.
func (service *Service) RequestOTP(ctx context.Context, phone string) (string, error) {
	// The reserved review number never issues a real code — the reviewer already knows the
	// fixed bypass code. No DB write, no rate limit.
	if service.isDemo(phone) {
		return service.demoCode, nil
	}

	queries := sqlcgen.New(service.pool)

	recent, err := queries.CountRecentOtpChallenges(ctx, sqlcgen.CountRecentOtpChallengesParams{
		Phone:         phone,
		Purpose:       "LOGIN",
		WithinSeconds: otpResendGuard,
	})
	if err != nil {
		return "", fmt.Errorf("checking recent otps: %w", err)
	}
	if recent > 0 {
		return "", ErrOtpRateLimited
	}

	code, err := randomCode(otpDigits)
	if err != nil {
		return "", err
	}

	// bcrypt, never plaintext (PLAN-P0 Task 6). A database dump is then not a list of live
	// login codes.
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hashing otp: %w", err)
	}

	if _, err := queries.InsertOtpChallenge(ctx, sqlcgen.InsertOtpChallengeParams{
		Purpose:     "LOGIN",
		Phone:       phone,
		CodeHash:    string(hash),
		ExpiresAt:   pgTimestamp(time.Now().Add(otpTTL)),
		MaxAttempts: otpMaxAttempts,
	}); err != nil {
		return "", fmt.Errorf("storing otp: %w", err)
	}

	return code, nil
}

// VerifyOTP checks a code and, on success, returns the user — creating a CUSTOMER on first
// login. Staff (TECHNICIAN, ADMIN) are provisioned ahead of time, so an unknown phone is
// always a new customer.
func (service *Service) VerifyOTP(ctx context.Context, phone, code string) (User, error) {
	queries := sqlcgen.New(service.pool)

	// App Review bypass: the reserved number accepts only the fixed code, and returns whatever
	// user is provisioned for it (its role decides which app the reviewer can exercise).
	if service.isDemo(phone) {
		if code != service.demoCode {
			return User{}, ErrOtpInvalid
		}
		return service.findOrCreateCustomer(ctx, queries, phone)
	}

	challenge, err := queries.GetLiveOtpChallenge(ctx, sqlcgen.GetLiveOtpChallengeParams{
		Phone:   phone,
		Purpose: "LOGIN",
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrOtpInvalid // no live challenge — expired or never issued
	}
	if err != nil {
		return User{}, fmt.Errorf("reading otp: %w", err)
	}

	if challenge.Attempts >= challenge.MaxAttempts {
		// Burn it so it cannot be hammered further, then refuse.
		if err := queries.ConsumeOtpChallenge(ctx, challenge.ID); err != nil {
			return User{}, fmt.Errorf("consuming exhausted otp: %w", err)
		}
		return User{}, ErrOtpTooManyAttempts
	}

	if bcrypt.CompareHashAndPassword([]byte(challenge.CodeHash), []byte(code)) != nil {
		// Wrong code: count the attempt (so the cap means something) and refuse.
		if err := queries.IncrementOtpAttempts(ctx, challenge.ID); err != nil {
			return User{}, fmt.Errorf("recording failed attempt: %w", err)
		}
		return User{}, ErrOtpInvalid
	}

	// Correct. Consume the challenge so the same code can never be replayed.
	if err := queries.ConsumeOtpChallenge(ctx, challenge.ID); err != nil {
		return User{}, fmt.Errorf("consuming otp: %w", err)
	}

	return service.findOrCreateCustomer(ctx, queries, phone)
}

func (service *Service) findOrCreateCustomer(ctx context.Context, queries *sqlcgen.Queries, phone string) (User, error) {
	existing, err := queries.GetUserByPhone(ctx, phone)
	switch {
	case err == nil:
		role, perr := ParseRole(existing.Role)
		if perr != nil {
			return User{}, perr
		}
		return User{ID: existing.ID, Phone: existing.Phone, Name: existing.Name, Role: role}, nil

	case errors.Is(err, pgx.ErrNoRows):
		created, cerr := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
			Phone: phone,
			Name:  "", // set later via profile; the column allows empty, not null
			Role:  string(RoleCustomer),
		})
		if cerr != nil {
			return User{}, fmt.Errorf("creating customer: %w", cerr)
		}
		return User{ID: created.ID, Phone: created.Phone, Name: created.Name, Role: RoleCustomer}, nil

	default:
		return User{}, fmt.Errorf("looking up user: %w", err)
	}
}

// RecomputeTechnicianRating recomputes a technician's rating as the average of their reviews.
// It is the review.submitted consumer, and idempotent: recomputing from the same reviews
// yields the same average, so an at-least-once redelivery is harmless.
func (service *Service) RecomputeTechnicianRating(ctx context.Context, technicianID uuid.UUID) error {
	if err := sqlcgen.New(service.pool).RecomputeTechnicianRating(ctx, technicianID); err != nil {
		return fmt.Errorf("recomputing technician rating: %w", err)
	}
	return nil
}

// randomCode returns a numeric code of the given length using crypto/rand — NOT math/rand,
// whose output is predictable and would make codes guessable.
func randomCode(length int) (string, error) {
	const digits = "0123456789"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generating otp: %w", err)
	}
	for index := range buf {
		buf[index] = digits[int(buf[index])%len(digits)]
	}
	return string(buf), nil
}

func pgTimestamp(at time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: at, Valid: true}
}
