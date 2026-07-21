package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// This file is the seam between our hand-written domain services and huma, the library that
// turns typed handlers into an OpenAPI 3.1 contract. huma wraps the SAME *http.ServeMux the rest
// of the app already uses, so migrated (typed) operations and any not-yet-migrated raw handlers
// coexist on one router. The generated spec is the single source of truth the mobile client is
// codegen'd from — the client cannot call an endpoint or read a field the Go types don't declare.

// securityBearer is the name of the JWT bearer scheme in the OpenAPI document. An operation that
// lists it under Security is enforced by authMiddleware and shows a lock in the generated client.
const securityBearer = "bearer"

// roleMetadataKey is where an operation stashes the identity.Role it requires, read back by
// authMiddleware. Keeping it in Operation.Metadata means the authorization rule stays declared
// right at the route, exactly as the old RequireRole middleware did.
const roleMetadataKey = "requiredRole"

// humaUserKey is the context key under which authMiddleware stores the authenticated user, read
// by operation handlers via userFromContext. Unexported so nothing else can forge it.
type humaUserKey struct{}

// NewHumaAPI wraps mux in a huma API configured with the bearer scheme and the auth middleware.
// Both buildRouter (production) and the test harness call this so migrated operations are
// enforced and documented identically in both.
func NewHumaAPI(mux *http.ServeMux, signer *auth.Signer) huma.API {
	config := huma.DefaultConfig("SETHU-CARE API", "1.0.0")

	// Fields are optional at the schema layer: our domain services do their own validation and
	// return typed domain errors, so requiredness is enforced (and its status code chosen) by the
	// handler, not by huma's generic 422. This keeps behaviour identical to the raw handlers.
	config.FieldsOptionalByDefault = true

	// Drop huma's default "$schema" body-link transformer: we want response bodies to be exactly
	// the DTO, consistent with the not-yet-migrated raw handlers and clean for the generated client.
	config.CreateHooks = nil

	config.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		securityBearer: {Type: "http", Scheme: "bearer", BearerFormat: "JWT"},
	}
	api := humago.New(mux, config)
	api.UseMiddleware(authMiddleware(api, signer))
	return api
}

// bearerSecurity is the Security value for an operation that requires a valid token.
func bearerSecurity() []map[string][]string {
	return []map[string][]string{{securityBearer: {}}}
}

// roleMetadata declares that an operation requires a specific role (and, implicitly, auth).
func roleMetadata(role identity.Role) map[string]any {
	return map[string]any{roleMetadataKey: role}
}

// authMiddleware enforces the same rules the old RequireAuth/RequireRole middleware did, but for
// huma operations: it runs only for operations that declare the bearer scheme, parses the token
// with the existing signer, checks any required role, and stashes the user in the context.
func authMiddleware(api huma.API, signer *auth.Signer) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		operation := ctx.Operation()
		if !operationRequiresAuth(operation) {
			next(ctx)
			return
		}

		raw, ok := bearerFromHeader(ctx.Header("Authorization"))
		if !ok {
			writeUnauthorized(api, ctx, "missing or malformed Authorization header")
			return
		}
		user, err := signer.Parse(raw)
		if err != nil {
			// Deliberately vague — never reveal whether the token was expired, tampered, or junk.
			writeUnauthorized(api, ctx, "invalid or expired token")
			return
		}
		if role, required := operationRole(operation); required && user.Role != role {
			writeHumaAuthError(api, ctx, http.StatusForbidden, "requires "+role.String()+" role")
			return
		}

		next(huma.WithValue(ctx, humaUserKey{}, user))
	}
}

func writeUnauthorized(api huma.API, ctx huma.Context, message string) {
	ctx.SetHeader("WWW-Authenticate", "Bearer")
	writeHumaAuthError(api, ctx, http.StatusUnauthorized, message)
}

// writeHumaAuthError writes an auth failure. A WriteErr failure means the connection is already
// gone, so there is nothing to do but log it — the status line is on its way regardless.
func writeHumaAuthError(api huma.API, ctx huma.Context, status int, message string) {
	if err := huma.WriteErr(api, ctx, status, message); err != nil {
		slog.Default().Error("writing auth error", "err", err)
	}
}

func operationRequiresAuth(operation *huma.Operation) bool {
	for _, requirement := range operation.Security {
		if _, ok := requirement[securityBearer]; ok {
			return true
		}
	}
	return false
}

func operationRole(operation *huma.Operation) (identity.Role, bool) {
	if operation.Metadata == nil {
		return "", false
	}
	role, ok := operation.Metadata[roleMetadataKey].(identity.Role)
	return role, ok
}

// userFromContext returns the authenticated user an operation handler runs on behalf of. It is
// the huma-side equivalent of auth.UserFrom; ok is false only if the operation forgot to declare
// the bearer scheme (a programming error), so handlers behind auth can treat it as present.
func userFromContext(ctx context.Context) (auth.AuthedUser, bool) {
	user, ok := ctx.Value(humaUserKey{}).(auth.AuthedUser)
	return user, ok
}

func bearerFromHeader(header string) (string, bool) {
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	return strings.TrimSpace(header[len(prefix):]), true
}

// toHumaError is the ONE place a domain error becomes a huma HTTP error, reusing the same
// classify() the raw handlers use so status-code mapping stays identical across both. A 5xx is
// logged server-side and its detail withheld from the client, exactly as writeError does.
func toHumaError(log *slog.Logger, err error) error {
	status, message := classify(err)
	if status >= 500 {
		log.Error("request failed", "err", err)
		return huma.Error500InternalServerError("internal error")
	}
	return huma.NewError(status, message)
}
