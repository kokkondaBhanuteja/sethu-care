package auth_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

const testSecret = "test-secret-at-least-thirty-two-bytes-long!!"

func newSigner(t *testing.T) *auth.Signer {
	t.Helper()
	s, err := auth.NewSigner(testSecret, time.Hour)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	return s
}

func mustIssue(t *testing.T, s *auth.Signer, u auth.AuthedUser) string {
	t.Helper()
	tok, err := s.Issue(u)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	return tok
}

func TestNewSignerRejectsWeakSecret(t *testing.T) {
	if _, err := auth.NewSigner("too-short", time.Hour); err == nil {
		t.Error("NewSigner accepted a <32-byte secret; a guessable HMAC key means forgeable admin tokens")
	}
}

func TestIssueThenParseRoundTrips(t *testing.T) {
	s := newSigner(t)
	want := auth.AuthedUser{ID: uuid.New(), Role: identity.RoleAdmin}

	token, err := s.Issue(want)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	got, err := s.Parse(token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if got != want {
		t.Errorf("round trip = %+v, want %+v", got, want)
	}
}

// A token signed with a DIFFERENT secret must be rejected — this is the core guarantee.
func TestParseRejectsTokenSignedWithAnotherSecret(t *testing.T) {
	attacker, err := auth.NewSigner("a-totally-different-secret-32-bytes-long", time.Hour)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	token := mustIssue(t, attacker, auth.AuthedUser{ID: uuid.New(), Role: identity.RoleAdmin})

	if _, err := newSigner(t).Parse(token); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Parse accepted a token signed with the wrong secret; err = %v", err)
	}
}

// A tampered token (any byte flipped) must fail the signature check.
func TestParseRejectsTamperedToken(t *testing.T) {
	s := newSigner(t)
	token := mustIssue(t, s, auth.AuthedUser{ID: uuid.New(), Role: identity.RoleCustomer})

	tampered := token[:len(token)-3] + "AAA"
	if _, err := s.Parse(tampered); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Parse accepted a tampered token; err = %v", err)
	}
}

// An expired token must be rejected. now() is injected so this is deterministic, not a sleep.
func TestParseRejectsExpiredToken(t *testing.T) {
	// Issue a token, then parse it as if it were far in the future.
	past, err := auth.NewSignerAt(testSecret, time.Minute, func() time.Time {
		return time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	})
	if err != nil {
		t.Fatal(err)
	}
	token := mustIssue(t, past, auth.AuthedUser{ID: uuid.New(), Role: identity.RoleCustomer})

	future, err := auth.NewSignerAt(testSecret, time.Minute, func() time.Time {
		return time.Date(2020, 1, 1, 1, 0, 0, 0, time.UTC) // an hour later; token lived a minute
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := future.Parse(token); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Parse accepted an expired token; err = %v", err)
	}
}

// THE alg-confusion attack: a token with alg=none must never be accepted.
func TestParseRejectsAlgNone(t *testing.T) {
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{
		Subject:   uuid.NewString(),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	// UnsafeAllowNoneSignatureType is how you sign an alg=none token — exactly the forged
	// token an attacker would craft.
	unsigned, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("building none-token: %v", err)
	}
	if _, err := newSigner(t).Parse(unsigned); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Parse accepted an alg=none token — the classic JWT forgery; err = %v", err)
	}
}

func TestParseRejectsUnknownRole(t *testing.T) {
	// Hand-craft a token with a role that is not one of ours, signed with the right secret.
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  uuid.NewString(),
		"role": "SUPERADMIN",
		"exp":  time.Now().Add(time.Hour).Unix(),
	})
	signed, err := tok.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("signing: %v", err)
	}
	if _, err := newSigner(t).Parse(signed); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Parse accepted a token with an unknown role; err = %v", err)
	}
}

func TestParseRejectsGarbage(t *testing.T) {
	for _, junk := range []string{"", "not.a.token", strings.Repeat("x", 40)} {
		if _, err := newSigner(t).Parse(junk); !errors.Is(err, auth.ErrInvalidToken) {
			t.Errorf("Parse(%q) accepted garbage; err = %v", junk, err)
		}
	}
}
