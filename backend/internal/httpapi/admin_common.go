package httpapi

import (
	"encoding/json"
	"log/slog"
	"reflect"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/adminaccount"
	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/sms"
)

// This file and its admin_*.go siblings declare the SETHU-CARE admin console's API contract as
// huma operations. The contract was declared first — every handler returned 501 so the OpenAPI
// document (and therefore the console's generated client) existed before the server-side work
// did. Phase 1 filled in the operations whose data already exists in the domain (dashboard,
// bookings list/detail, audit list); the rest still return 501 behind the same frozen contract.
//
// Two rules the DTOs below hold themselves to, decided when the contract was reviewed:
//
//  1. Enums carry CODES, never console i18n keys. A document type is AADHAAR, not
//     "document.aadhaar" — the backend must not become contractually responsible for emitting
//     the frontend's translation keys.
//  2. No pre-composed English on the wire. A field is the structured data the console needs to
//     compose its own sentence (`stage` + `etaMinutes`), never the sentence itself
//     ("En route · ETA 8m"), because a composed English string cannot be shown in Hindi or Telugu.

// adminSchemaRefPrefix is where huma puts component schemas in the generated document. The
// hand-registered schemas below (enums, unions) reference each other through it.
const adminSchemaRefPrefix = "#/components/schemas/"

// AdminHandler serves the admin console. Every operation is ADMIN-only except the sign-in flows,
// which cannot be — they are how an admin obtains a token in the first place.
//
// It holds the domain services behind the Phase-1 operations; operations still awaiting their
// domain (alerts, providers, applications, payouts, …) keep returning 501.
type AdminHandler struct {
	log      *slog.Logger
	ops      *ops.Service
	bookings *booking.Service
	ledger   *ledger.Service
	audit    *audit.Service

	// The Phase-2 sign-in and settings surface: the account aggregate, the signer that
	// mints its bearers, the SMS sender that carries the second factor, and the dev-echo
	// flag mirroring AuthHandler's (log the code in dev; never in a response).
	accounts    *adminaccount.Service
	signer      *auth.Signer
	otpSender   sms.Sender
	devEchoOTP  bool
	environment string
}

// NewAdminHandler builds the admin console handler.
func NewAdminHandler(log *slog.Logger, opsService *ops.Service, bookingService *booking.Service, ledgerService *ledger.Service, auditService *audit.Service, accountService *adminaccount.Service, signer *auth.Signer, otpSender sms.Sender, devEchoOTP bool, environment string) *AdminHandler {
	if environment == "" {
		environment = "development"
	}
	return &AdminHandler{
		log: log, ops: opsService, bookings: bookingService, ledger: ledgerService, audit: auditService,
		accounts: accountService, signer: signer, otpSender: otpSender, devEchoOTP: devEchoOTP, environment: environment,
	}
}

// adminBookingReference derives the operator-facing booking reference ("#B-8823A0FF") from the
// id: the first eight hex digits, uppercased. Bookings carry no stored reference column yet, so
// the reference is a stable projection of the id — and search reverses the projection by prefix-
// matching the id.
func adminBookingReference(bookingID uuid.UUID) string {
	return "#B-" + strings.ToUpper(strings.ReplaceAll(bookingID.String(), "-", "")[:8])
}

// RegisterHuma registers every admin-console operation. The list is split across admin_*.go by
// domain so no single file carries all sixty-five.
func (handler *AdminHandler) RegisterHuma(api huma.API) {
	handler.registerAdminAuth(api)
	handler.registerAdminSettings(api)
	handler.registerAdminDashboard(api)
	handler.registerAdminAlerts(api)
	handler.registerAdminBookings(api)
	handler.registerAdminProviders(api)
	handler.registerAdminBookingActions(api)
	handler.registerAdminApplications(api)
	handler.registerAdminAudit(api)
	handler.registerAdminMap(api)
	handler.registerAdminPayouts(api)
	handler.registerAdminV11(api)

	// Paginated is the shape every list endpoint composes; it is documented for readers of the
	// contract rather than returned by any one operation, so it is registered explicitly.
	registerAdminSchema(api, reflect.TypeFor[paginated]())
}

// notImplemented is the body of every operation in this file's siblings: the contract is
// declared, the server-side work is not done. Naming the operation keeps the 501 diagnosable
// from a client log alone.
func notImplemented(operationID string) error {
	return huma.Error501NotImplemented(operationID + ": declared in the API contract, not implemented yet")
}

// registerAdminSchema forces a type into the component list even when no operation references it.
func registerAdminSchema(api huma.API, schemaType reflect.Type) {
	api.OpenAPI().Components.Schemas.Schema(schemaType, true, schemaType.Name())
}

// adminNamedSchema registers a hand-written component schema once and returns a $ref to it.
//
// huma only mints component refs for STRUCT types, so a string enum or a discriminated union
// would otherwise be inlined at every use site. Registering it here keeps the generated document
// (and the console's generated types) naming these vocabularies once, as the contract does.
func adminNamedSchema(registry huma.Registry, name string, build func() *huma.Schema) *huma.Schema {
	if _, exists := registry.Map()[name]; !exists {
		registry.Map()[name] = build()
	}
	return &huma.Schema{Ref: adminSchemaRefPrefix + name}
}

// adminEnumSchema registers a named string enum. The values passed here ARE the closed set —
// there is no second list to drift from.
func adminEnumSchema(registry huma.Registry, name, doc string, values ...string) *huma.Schema {
	return adminNamedSchema(registry, name, func() *huma.Schema {
		allowed := make([]any, len(values))
		for index, value := range values {
			allowed[index] = value
		}
		return &huma.Schema{Type: huma.TypeString, Description: doc, Enum: allowed}
	})
}

// nullable is a field that is either a T or an explicit JSON null.
//
// A Go pointer already documents a nullable SCALAR, but huma refuses to mark a $ref nullable, so
// an object- or enum-valued field that the contract says may be null needs this wrapper: it emits
// `anyOf: [$ref, {type: null}]`, which is what the reviewed contract asks for.
type nullable[T any] struct {
	Value *T
}

// MarshalJSON writes the wrapped value, or a literal null when there is none.
func (value nullable[T]) MarshalJSON() ([]byte, error) {
	if value.Value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(value.Value)
}

// UnmarshalJSON reads a T or a literal null.
func (value *nullable[T]) UnmarshalJSON(raw []byte) error {
	if string(raw) == "null" {
		value.Value = nil
		return nil
	}
	inner := new(T)
	if err := json.Unmarshal(raw, inner); err != nil {
		return err
	}
	value.Value = inner
	return nil
}

// Schema makes the wrapper document itself as "the inner schema, or null".
func (nullable[T]) Schema(registry huma.Registry) *huma.Schema {
	innerType := reflect.TypeFor[T]()
	return &huma.Schema{
		AnyOf: []*huma.Schema{
			registry.Schema(innerType, true, innerType.Name()),
			{Type: "null"},
		},
	}
}

// adminResponse is one extra response an operation declares beyond its success body — the
// designed failures the console renders a dedicated state for.
type adminResponse struct {
	status      string
	description string
	body        any
}

// adminResponses builds an operation's response map: the declared failures plus the console's
// error envelope as the catch-all. huma fills in the success response from the output type.
func adminResponses(api huma.API, declared ...adminResponse) map[string]*huma.Response {
	registry := api.OpenAPI().Components.Schemas
	responses := make(map[string]*huma.Response, len(declared)+1)
	for _, entry := range declared {
		responses[entry.status] = adminJSONResponse(registry, entry.description, entry.body)
	}
	responses["default"] = adminJSONResponse(registry, "Error", adminError{})
	return responses
}

func adminJSONResponse(registry huma.Registry, description string, body any) *huma.Response {
	bodyType := reflect.TypeOf(body)
	return &huma.Response{
		Description: description,
		Content: map[string]*huma.MediaType{
			"application/json": {Schema: registry.Schema(bodyType, true, bodyType.Name())},
		},
	}
}

// AdminIdempotency is the header every non-idempotent admin mutation carries. It is minted once
// per OPERATOR INTENT, not per network attempt, so a retry after a flaky response replays the
// first result instead of acting twice.
type AdminIdempotency struct {
	IdempotencyKey string `header:"Idempotency-Key" required:"true" doc:"Idempotency key, minted once per operator intent (not per network attempt). Replaying a key must return the first result rather than acting again."`
}

// AdminPagination is the cursor-paged tail every list operation shares.
type AdminPagination struct {
	Limit  int32  `query:"limit" doc:"Page size. Omitted takes the server default."`
	Cursor string `query:"cursor" doc:"Opaque cursor from a previous response's nextCursor."`
}

// paginated is the envelope every list endpoint composes: { items, total, nextCursor? }. Each
// list ships its own concretely typed items; this documents the shape they share.
type paginated struct {
	NextCursor *string `json:"nextCursor" doc:"Absent or null on the last page."`
	Total      int32   `json:"total" required:"true" doc:"Rows the query matches in total, not the size of this page."`
}

// adminError is the admin console's error envelope, distinct from the customer/technician
// surface's RFC 7807 ErrorModel: the console reads { code, message, fields }.
type adminError struct {
	Code    string            `json:"code" required:"true" doc:"Machine-readable code. The console additionally derives ApiError.code from the status: 400/422 -> validation, 401 -> unauthorized, 403 -> forbidden, 404 -> not_found, 409 -> conflict, 429 -> rate_limited, 5xx -> server."`
	Fields  map[string]string `json:"fields,omitempty" doc:"Per-field validation messages, keyed by the request field name."`
	Message string            `json:"message" required:"true" doc:"Human-readable explanation. Never rendered verbatim to an operator."`
}

// staleVersionError is the optimistic-concurrency failure: the submitted version is not the
// record's current one. The console renders its dedicated "someone else just changed this" state.
type staleVersionError struct {
	Code           string `json:"code" required:"true" doc:"Always VERSION_CONFLICT."`
	CurrentVersion int32  `json:"currentVersion" required:"true" doc:"The version the record actually carries now."`
	Message        string `json:"message" required:"true"`
}

// rateLimitedError carries the reset instant so the console can count down rather than guess.
type rateLimitedError struct {
	Code    string    `json:"code" required:"true"`
	Message string    `json:"message" required:"true"`
	ResetAt time.Time `json:"resetAt" required:"true" doc:"When the limit window reopens."`
}
