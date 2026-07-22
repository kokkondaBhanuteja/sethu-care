package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
)

// The console's view of a booking: the segmented list and the full record with its dispatch
// timeline. The actions an operator can take on one live in admin_booking_actions.go.

func (handler *AdminHandler) registerAdminBookings(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsListBookings", Method: http.MethodGet, Path: "/ops/bookings",
		Summary: "List bookings for the console", Tags: []string{"Ops Bookings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listBookings)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetBooking", Method: http.MethodGet, Path: "/ops/bookings/{id}",
		Summary: "Full booking record with the dispatch timeline", Tags: []string{"Ops Bookings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.getBooking)
}

// ------------------------------------------------------------- vocabularies

// bookingState is the closed set of thirteen. Its values are read from booking.AllStates() rather
// than retyped, so the wire vocabulary CANNOT drift from internal/booking/state.go.
type bookingState string

// Schema names the booking-state vocabulary in the generated document.
func (bookingState) Schema(registry huma.Registry) *huma.Schema {
	states := booking.AllStates()
	values := make([]string, len(states))
	for index, state := range states {
		values[index] = state.String()
	}
	return adminEnumSchema(registry, "BookingState",
		"The closed set of thirteen, verbatim from internal/booking/state.go — this schema is generated from booking.AllStates(), so the two cannot drift.",
		values...)
}

// bookingSegment is three segments, not four: nothing is future-dated, so there is no `scheduled`
// segment. `cancelled` also holds FAILED.
type bookingSegment string

const (
	bookingSegmentActive    bookingSegment = "active"
	bookingSegmentCompleted bookingSegment = "completed"
	bookingSegmentCancelled bookingSegment = "cancelled"
)

// Schema names the booking-segment vocabulary in the generated document.
func (bookingSegment) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "BookingSegment",
		"Three segments, not four: nothing is future-dated, so there is no `scheduled` segment. `cancelled` also holds FAILED.",
		string(bookingSegmentActive), string(bookingSegmentCompleted), string(bookingSegmentCancelled))
}

// paymentMethod is how the customer actually paid. Its values come from ledger.AllPaymentMethods()
// so the console shows the same vocabulary the money side records.
type paymentMethod string

// Schema names the payment-method vocabulary in the generated document.
func (paymentMethod) Schema(registry huma.Registry) *huma.Schema {
	methods := ledger.AllPaymentMethods()
	values := make([]string, len(methods))
	for index, method := range methods {
		values[index] = method.String()
	}
	return adminEnumSchema(registry, "PaymentMethod",
		"How the customer paid, from ledger.AllPaymentMethods(). The console owns the wording; the server sends the code.",
		values...)
}

// providerNoteKind discriminates the trailing provider line on a booking row.
type providerNoteKind string

const (
	providerNoteKindNone          providerNoteKind = "none"
	providerNoteKindUnassignedFor providerNoteKind = "unassignedFor"
	providerNoteKindETA           providerNoteKind = "eta"
	providerNoteKindStartedAt     providerNoteKind = "startedAt"
	providerNoteKindArrivedAgo    providerNoteKind = "arrivedAgo"
	providerNoteKindRating        providerNoteKind = "rating"
)

// providerNote is the trailing provider line, as data plus a discriminant. Never a pre-built
// sentence: the console localises it.
type providerNote struct {
	At      *time.Time       `json:"at,omitempty"`
	Kind    providerNoteKind `json:"kind"`
	Minutes *int32           `json:"minutes,omitempty"`
	Rating  *float64         `json:"rating,omitempty"`
}

// Schema hand-writes the discriminated union, which Go struct tags cannot express: each variant
// carries exactly the one value its kind needs, so an `eta` note can never arrive without minutes.
func (providerNote) Schema(registry huma.Registry) *huma.Schema {
	return adminNamedSchema(registry, "ProviderNote", func() *huma.Schema {
		variant := func(kind providerNoteKind, valueName string, value *huma.Schema) *huma.Schema {
			properties := map[string]*huma.Schema{
				"kind": {Type: huma.TypeString, Enum: []any{string(kind)}},
			}
			required := []string{"kind"}
			if value != nil {
				properties[valueName] = value
				required = append(required, valueName)
			}
			return &huma.Schema{
				Type:                 huma.TypeObject,
				AdditionalProperties: false,
				Properties:           properties,
				Required:             required,
			}
		}
		minutes := func() *huma.Schema { return &huma.Schema{Type: huma.TypeInteger, Format: "int32"} }
		return &huma.Schema{
			Description: "The trailing provider line, as data plus a discriminant. Never a pre-built sentence: the console localises it.",
			OneOf: []*huma.Schema{
				variant(providerNoteKindNone, "", nil),
				variant(providerNoteKindUnassignedFor, "minutes", minutes()),
				variant(providerNoteKindETA, "minutes", minutes()),
				variant(providerNoteKindStartedAt, "at", &huma.Schema{Type: huma.TypeString, Format: "date-time"}),
				variant(providerNoteKindArrivedAgo, "minutes", minutes()),
				variant(providerNoteKindRating, "rating", &huma.Schema{Type: huma.TypeNumber, Format: "double"}),
			},
		}
	})
}

// --------------------------------------------------------------- the list

type bookingListItem struct {
	AmountPaise     int64        `json:"amountPaise" required:"true"`
	Area            string       `json:"area" required:"true"`
	CustomerName    string       `json:"customerName" required:"true"`
	CustomerPhone   string       `json:"customerPhone" required:"true" doc:"E.164. Formatted for display by the client."`
	ID              string       `json:"id" required:"true"`
	IsAdminVerified bool         `json:"isAdminVerified" required:"true" doc:"COMPLETED asserted by an admin rather than proved by the customer's OTP."`
	ProviderName    *string      `json:"providerName" required:"true"`
	ProviderNote    providerNote `json:"providerNote" required:"true"`
	Reference       string       `json:"reference" required:"true" doc:"The operator-facing reference, e.g. #B-8823."`
	ServiceName     string       `json:"serviceName" required:"true"`
	SlotAt          time.Time    `json:"slotAt" required:"true"`
	State           bookingState `json:"state" required:"true"`
}

type bookingSegmentCounts struct {
	Active              int32 `json:"active" required:"true"`
	ActiveHasEscalation bool  `json:"activeHasEscalation" required:"true" doc:"Drives the pulsing dot on the Active tab."`
	Cancelled           int32 `json:"cancelled" required:"true"`
	Completed           int32 `json:"completed" required:"true"`
}

type bookingsPage struct {
	Counts           bookingSegmentCounts `json:"counts" required:"true"`
	IsAcrossSegments bool                 `json:"isAcrossSegments" required:"true" doc:"True when the result set spans every segment, i.e. a search rather than a browse."`
	Items            []bookingListItem    `json:"items" required:"true" nullable:"false"`
	NextCursor       *string              `json:"nextCursor"`
	Total            int32                `json:"total" required:"true"`
}

type opsListBookingsInput struct {
	Segment bookingSegment `query:"segment" doc:"Defaults to active."`
	State   []bookingState `query:"state,explode" nullable:"false" doc:"Narrow to specific states within the segment."`
	Zone    string         `query:"zone" doc:"Zone name."`
	Service string         `query:"service" doc:"Service name."`
	Query   string         `query:"q" doc:"Free-text search. The console only sends it from three characters."`
	From    time.Time      `query:"from" doc:"Inclusive lower bound on the slot."`
	To      time.Time      `query:"to" doc:"Exclusive upper bound on the slot."`
	AdminPagination
}

type bookingsPageOutput struct {
	Body bookingsPage
}

func (handler *AdminHandler) listBookings(_ context.Context, _ *opsListBookingsInput) (*bookingsPageOutput, error) {
	return nil, notImplemented("opsListBookings")
}

// --------------------------------------------------------------- the record

type bookingCustomer struct {
	Address      string    `json:"address" required:"true"`
	BookingCount int32     `json:"bookingCount" required:"true"`
	JoinedAt     time.Time `json:"joinedAt" required:"true"`
	Name         string    `json:"name" required:"true"`
	Phone        string    `json:"phone" required:"true"`
}

type bookingProvider struct {
	CompletedAt *time.Time `json:"completedAt" required:"true"`
	ID          string     `json:"id" required:"true"`
	Name        string     `json:"name" required:"true"`
	Rating      float64    `json:"rating" required:"true"`
	StartedAt   *time.Time `json:"startedAt" required:"true"`
}

type bookingPayment struct {
	AmountPaise   int64         `json:"amountPaise" required:"true"`
	IsPrepaid     bool          `json:"isPrepaid" required:"true"`
	Last4         string        `json:"last4" required:"true"`
	Method        paymentMethod `json:"method" required:"true"`
	PaidAt        time.Time     `json:"paidAt" required:"true"`
	TransactionID string        `json:"transactionId" required:"true"`
}

// bookingEscalation is why a booking is on the escalation queue, as the danger banner states it.
type bookingEscalation struct {
	Declined          int32 `json:"declined" required:"true"`
	MinutesUnresolved int32 `json:"minutesUnresolved" required:"true" doc:"An elapsed count rather than a timestamp: the banner states an age."`
	Rounds            int32 `json:"rounds" required:"true"`
}

// dispatchRound is one auto-dispatch round — the 'why did this fail' diagnostic.
type dispatchRound struct {
	Contacted int32   `json:"contacted" required:"true"`
	Declined  int32   `json:"declined" required:"true"`
	RadiusKm  float64 `json:"radiusKm" required:"true"`
	Round     int32   `json:"round" required:"true" doc:"1-based. Round 2 is the first widened retry."`
}

type bookingEventKind string

const (
	bookingEventKindCreated             bookingEventKind = "created"
	bookingEventKindSearching           bookingEventKind = "searching"
	bookingEventKindDispatchRound       bookingEventKind = "dispatchRound"
	bookingEventKindAutoAssigned        bookingEventKind = "autoAssigned"
	bookingEventKindEnRoute             bookingEventKind = "enRoute"
	bookingEventKindArrived             bookingEventKind = "arrived"
	bookingEventKindStarted             bookingEventKind = "started"
	bookingEventKindCompletionOTPFailed bookingEventKind = "completionOtpFailed"
	bookingEventKindCompleted           bookingEventKind = "completed"
	bookingEventKindCompletedByAdmin    bookingEventKind = "completedByAdmin"
	bookingEventKindAssignmentFailed    bookingEventKind = "assignmentFailed"
	bookingEventKindEscalated           bookingEventKind = "escalated"
	bookingEventKindCancelled           bookingEventKind = "cancelled"
)

// Schema names the timeline vocabulary in the generated document.
func (bookingEventKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "BookingEventKind", "",
		string(bookingEventKindCreated), string(bookingEventKindSearching), string(bookingEventKindDispatchRound),
		string(bookingEventKindAutoAssigned), string(bookingEventKindEnRoute), string(bookingEventKindArrived),
		string(bookingEventKindStarted), string(bookingEventKindCompletionOTPFailed), string(bookingEventKindCompleted),
		string(bookingEventKindCompletedByAdmin), string(bookingEventKindAssignmentFailed),
		string(bookingEventKindEscalated), string(bookingEventKindCancelled))
}

type bookingEvent struct {
	ActorName    string           `json:"actorName,omitempty" doc:"Named where the event turns on who did it — an admin-verified completion, a manual assign."`
	At           time.Time        `json:"at" required:"true"`
	ID           string           `json:"id" required:"true"`
	Kind         bookingEventKind `json:"kind" required:"true"`
	ProviderName string           `json:"providerName,omitempty"`
	Round        *dispatchRound   `json:"round,omitempty" doc:"Present on dispatchRound events."`
}

type bookingAdminActivityKind string

const (
	bookingAdminActivityKindViewed             bookingAdminActivityKind = "viewed"
	bookingAdminActivityKindSystemEscalated    bookingAdminActivityKind = "systemEscalated"
	bookingAdminActivityKindSystemAutoAssigned bookingAdminActivityKind = "systemAutoAssigned"
	bookingAdminActivityKindVerifiedCompletion bookingAdminActivityKind = "verifiedCompletion"
)

// Schema names the admin-activity vocabulary in the generated document.
func (bookingAdminActivityKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "BookingAdminActivityKind", "",
		string(bookingAdminActivityKindViewed), string(bookingAdminActivityKindSystemEscalated),
		string(bookingAdminActivityKindSystemAutoAssigned), string(bookingAdminActivityKindVerifiedCompletion))
}

type bookingAdminActivity struct {
	ActorName string                   `json:"actorName,omitempty"`
	At        time.Time                `json:"at" required:"true"`
	ID        string                   `json:"id" required:"true"`
	Kind      bookingAdminActivityKind `json:"kind" required:"true"`
}

// bookingConcurrentChange reports that someone else moved this record while it was open. Rendered
// as a banner, never applied silently.
type bookingConcurrentChange struct {
	ActorName    string    `json:"actorName" required:"true"`
	At           time.Time `json:"at" required:"true"`
	ProviderName string    `json:"providerName" required:"true"`
}

// bookingVerification is the accountability trail behind an admin-asserted completion.
type bookingVerification struct {
	DisputeWindowClosesAt time.Time `json:"disputeWindowClosesAt" required:"true"`
	VerifiedAt            time.Time `json:"verifiedAt" required:"true"`
	VerifiedByName        string    `json:"verifiedByName" required:"true"`
}

type bookingDetail struct {
	AdminActivity    []bookingAdminActivity            `json:"adminActivity" required:"true" nullable:"false"`
	AmountPaise      int64                             `json:"amountPaise" required:"true"`
	Area             string                            `json:"area" required:"true"`
	ConcurrentChange nullable[bookingConcurrentChange] `json:"concurrentChange" required:"true"`
	CreatedAt        time.Time                         `json:"createdAt" required:"true"`
	Customer         bookingCustomer                   `json:"customer" required:"true"`
	DeclinedTotal    int32                             `json:"declinedTotal" required:"true"`
	DispatchRounds   []dispatchRound                   `json:"dispatchRounds" required:"true" nullable:"false"`
	Escalation       nullable[bookingEscalation]       `json:"escalation" required:"true"`
	ID               string                            `json:"id" required:"true"`
	IsAdminVerified  bool                              `json:"isAdminVerified" required:"true"`
	Notes            []string                          `json:"notes" required:"true" nullable:"false"`
	Payment          bookingPayment                    `json:"payment" required:"true"`
	Provider         nullable[bookingProvider]         `json:"provider" required:"true"`
	Reference        string                            `json:"reference" required:"true"`
	ServiceTitle     string                            `json:"serviceTitle" required:"true"`
	State            bookingState                      `json:"state" required:"true"`
	Timeline         []bookingEvent                    `json:"timeline" required:"true" nullable:"false" doc:"Includes the auto-dispatch rounds. That diagnostic is the whole reason the timeline exists now that dispatch is automated."`
	Verification     nullable[bookingVerification]     `json:"verification" required:"true"`
	Version          int32                             `json:"version" required:"true" doc:"Optimistic-concurrency token; mutations send it back and a stale one is 409."`
}

type opsGetBookingInput struct {
	ID string `path:"id" doc:"Booking id"`
}

type bookingDetailOutput struct {
	Body bookingDetail
}

func (handler *AdminHandler) getBooking(_ context.Context, _ *opsGetBookingInput) (*bookingDetailOutput, error) {
	return nil, notImplemented("opsGetBooking")
}
