// Package auth signs and verifies the JWTs that authenticate a caller, and provides the
// middleware that guards routes. It knows about identity.Role but nothing about the
// database — a token is self-contained proof, checked without a query.
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// ErrInvalidToken covers every reason a token is not acceptable — malformed, wrong
// signature, expired, wrong algorithm. The caller gets one 401 regardless; leaking WHICH
// check failed only helps an attacker.
var ErrInvalidToken = errors.New("auth: invalid token")

// AuthedUser is who the caller is, extracted from a verified token. This is what handlers
// read to know the actor — never a header they could forge.
type AuthedUser struct {
	ID   uuid.UUID
	Role identity.Role
}

// Signer issues and verifies tokens with one HS256 secret.
//
// GO LESSON — the secret is a []byte held in the struct, injected at construction. There is
// no global and no package-level state, so a test can spin up its own Signer with its own
// secret, and production reads the real secret from the environment exactly once, in main.
type Signer struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time // injectable so tests can forge an expired token deterministically
}

// NewSigner builds a Signer. A short secret is rejected loudly: an HS256 token is only as
// strong as its key, and a guessable key means anyone can mint an admin token.
func NewSigner(secret string, ttl time.Duration) (*Signer, error) {
	return NewSignerAt(secret, ttl, time.Now)
}

// NewSignerAt is NewSigner with an injectable clock, so tests can issue and verify tokens at
// controlled times (e.g. to prove an expired token is rejected) without sleeping.
func NewSignerAt(secret string, ttl time.Duration, now func() time.Time) (*Signer, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("auth: jwt secret must be at least 32 bytes, got %d", len(secret))
	}
	return &Signer{secret: []byte(secret), ttl: ttl, now: now}, nil
}

// claims is the token body. RegisteredClaims carries sub/exp/iat; we add the role so
// authorization needs no database lookup.
type claims struct {
	Role identity.Role `json:"role"`
	jwt.RegisteredClaims
}

// Issue mints a signed token for a user.
func (signer *Signer) Issue(user AuthedUser) (string, error) {
	now := signer.now()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(signer.ttl)),
		},
	})
	signed, err := tok.SignedString(signer.secret)
	if err != nil {
		return "", fmt.Errorf("auth: signing token: %w", err)
	}
	return signed, nil
}

// Parse verifies a token and returns who it belongs to.
//
// It PINS the algorithm to HS256. Without this, the classic JWT attack applies: an attacker
// re-signs the token with alg=none, or with alg=RS256 using our public key as the HMAC
// secret, and the library would happily accept it. Refusing any method but the one we issue
// closes that door.
func (signer *Signer) Parse(token string) (AuthedUser, error) {
	parsed, err := jwt.ParseWithClaims(token, &claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("%w: unexpected signing method %v", ErrInvalidToken, t.Header["alg"])
		}
		return signer.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithTimeFunc(signer.now))
	if err != nil {
		return AuthedUser{}, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}

	c, ok := parsed.Claims.(*claims)
	if !ok || !parsed.Valid {
		return AuthedUser{}, ErrInvalidToken
	}

	id, err := uuid.Parse(c.Subject)
	if err != nil {
		return AuthedUser{}, fmt.Errorf("%w: subject is not a uuid", ErrInvalidToken)
	}
	if !c.Role.Valid() {
		return AuthedUser{}, fmt.Errorf("%w: unknown role %q", ErrInvalidToken, c.Role)
	}

	return AuthedUser{ID: id, Role: c.Role}, nil
}
