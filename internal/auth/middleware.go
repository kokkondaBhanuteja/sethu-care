package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// ctxKey is unexported so no other package can write or read the authed user under this key
// by accident. This is the standard Go pattern for request-scoped values.
type ctxKey struct{}

// UserFrom returns the authenticated user placed in the context by RequireAuth. The bool is
// false on an unauthenticated request — a handler behind RequireAuth can treat that as
// impossible, but the signature makes the possibility explicit rather than a nil surprise.
func UserFrom(ctx context.Context) (AuthedUser, bool) {
	u, ok := ctx.Value(ctxKey{}).(AuthedUser)
	return u, ok
}

// RequireAuth is middleware that rejects any request without a valid Bearer token, and
// otherwise stashes the authenticated user in the context for the handler.
//
// GO LESSON — middleware in Go is just a function that takes an http.Handler and returns
// one. Wrapping composes: RequireRole(ADMIN) wraps RequireAuth wraps the handler, and the
// request falls through each layer in order.
func (s *Signer) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := bearerToken(r)
		if !ok {
			writeAuthError(w, http.StatusUnauthorized, "missing or malformed Authorization header")
			return
		}

		user, err := s.Parse(raw)
		if err != nil {
			// Deliberately vague: never tell the caller whether the token was expired,
			// tampered, or nonsense.
			writeAuthError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), ctxKey{}, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole wraps a handler so only a caller with the given role may reach it. It must sit
// INSIDE RequireAuth (which puts the user in context); on its own it denies everything.
func RequireRole(role identity.Role, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFrom(r.Context())
		if !ok {
			writeAuthError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if user.Role != role {
			// 403, not 404: the caller is known, they are simply not allowed. Telling them
			// so is fine — they authenticated.
			writeAuthError(w, http.StatusForbidden, "requires "+role.String()+" role")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func bearerToken(r *http.Request) (string, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return "", false
	}
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	return strings.TrimSpace(header[len(prefix):]), true
}

func writeAuthError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("WWW-Authenticate", "Bearer")
	w.WriteHeader(code)
	//nolint:errcheck // the status is already written; a failed encode has nowhere to go
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
