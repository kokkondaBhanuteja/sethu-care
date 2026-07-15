package identity_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// The happy path: request a code, verify it, and get a CUSTOMER created on first login.
func TestRequestThenVerifyCreatesCustomer(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	phone := "+919000000001"

	code, err := svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}
	if len(code) != 6 {
		t.Errorf("code = %q, want 6 digits", code)
	}

	user, err := svc.VerifyOTP(ctx, phone, code)
	if err != nil {
		t.Fatalf("VerifyOTP: %v", err)
	}
	if user.Role != identity.RoleCustomer {
		t.Errorf("new user role = %s, want CUSTOMER", user.Role)
	}
	if user.Phone != phone {
		t.Errorf("phone = %s, want %s", user.Phone, phone)
	}
}

// A returning user keeps their identity and role — not a new customer each login.
func TestVerifyReturnsExistingUserWithTheirRole(t *testing.T) {
	svc, pool := newService(t)
	ctx := context.Background()
	phone := "+919000000009"

	// Pre-provision an ADMIN with this phone.
	adminID := uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops', 'ADMIN')", adminID, phone)

	code, err := svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}
	user, err := svc.VerifyOTP(ctx, phone, code)
	if err != nil {
		t.Fatalf("VerifyOTP: %v", err)
	}
	if user.ID != adminID {
		t.Errorf("id = %s, want the pre-provisioned admin %s", user.ID, adminID)
	}
	if user.Role != identity.RoleAdmin {
		t.Errorf("role = %s, want ADMIN — staff must not be downgraded to customer on login", user.Role)
	}
}

// The wrong code is refused, and — the security point — the code can no longer be replayed
// once consumed.
func TestWrongCodeRejectedAndCorrectCodeConsumed(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	phone := "+919000000002"

	code, err := svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}

	if _, err := svc.VerifyOTP(ctx, phone, "000000"); !errors.Is(err, identity.ErrOtpInvalid) {
		// note: a real wrong code (unless it happens to equal the random one) must be invalid
		if code != "000000" {
			t.Errorf("wrong code error = %v, want ErrOtpInvalid", err)
		}
	}

	// The right code works once...
	if _, err := svc.VerifyOTP(ctx, phone, code); err != nil {
		t.Fatalf("correct code failed: %v", err)
	}
	// ...and never again — it was consumed.
	if _, err := svc.VerifyOTP(ctx, phone, code); !errors.Is(err, identity.ErrOtpInvalid) {
		t.Errorf("replayed code error = %v, want ErrOtpInvalid — a consumed code must not work twice", err)
	}
}

// Guessing is capped: after max attempts the challenge is burned, even for the right code.
func TestAttemptsAreCapped(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	phone := "+919000000003"

	code, err := svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}

	// Five wrong guesses (otpMaxAttempts). Use a code we know is wrong.
	wrong := "111111"
	if code == wrong {
		wrong = "222222"
	}
	for range 5 {
		if _, err := svc.VerifyOTP(ctx, phone, wrong); !errors.Is(err, identity.ErrOtpInvalid) {
			t.Fatalf("expected ErrOtpInvalid during guessing, got %v", err)
		}
	}

	// Now even the CORRECT code is refused — the challenge is burned.
	if _, err := svc.VerifyOTP(ctx, phone, code); !errors.Is(err, identity.ErrOtpTooManyAttempts) {
		t.Errorf("after the cap, error = %v, want ErrOtpTooManyAttempts", err)
	}
}

// A second request too soon is rate-limited.
func TestResendIsRateLimited(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	phone := "+919000000004"

	if _, err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatalf("first RequestOTP: %v", err)
	}
	if _, err := svc.RequestOTP(ctx, phone); !errors.Is(err, identity.ErrOtpRateLimited) {
		t.Errorf("immediate resend error = %v, want ErrOtpRateLimited", err)
	}
}

// A code is never stored in plaintext — only a bcrypt hash.
func TestCodeIsStoredHashedNotPlaintext(t *testing.T) {
	svc, pool := newService(t)
	ctx := context.Background()
	phone := "+919000000005"

	code, err := svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}

	var stored string
	if err := pool.QueryRow(ctx, "SELECT code_hash FROM otp_challenges WHERE phone=$1", phone).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == code {
		t.Fatal("the code is stored in PLAINTEXT — a database dump would be a list of live codes")
	}
	if len(stored) < 20 || stored[:4] != "$2a$" && stored[:4] != "$2b$" {
		t.Errorf("stored value %q does not look like a bcrypt hash", stored)
	}
}

// ---------------------------------------------------------------------------

func newService(t *testing.T) (*identity.Service, *pgxpool.Pool) {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	return identity.NewService(pool), pool
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v", err)
	}
}
