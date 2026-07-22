package httpapi

import (
	"context"
	"net/http"
	"strings"
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

func (handler *AdminHandler) listBookings(ctx context.Context, input *opsListBookingsInput) (*bookingsPageOutput, error) {
	var segment booking.AdminSegment
	switch input.Segment {
	case bookingSegmentActive, "":
		segment = booking.AdminSegmentActive
	case bookingSegmentCompleted:
		segment = booking.AdminSegmentCompleted
	case bookingSegmentCancelled:
		segment = booking.AdminSegmentCancelled
	default:
		return nil, toHumaError(handler.log, &badRequestError{msg: "unknown segment"})
	}

	states := make([]booking.State, len(input.State))
	for index, rawState := range input.State {
		state, err := booking.ParseState(string(rawState))
		if err != nil {
			return nil, toHumaError(handler.log, &badRequestError{msg: "unknown state " + string(rawState)})
		}
		states[index] = state
	}

	listInput := booking.AdminListInput{
		Segment: segment,
		States:  states,
		Zone:    input.Zone,
		Service: input.Service,
		Search:  strings.TrimSpace(input.Query),
		Limit:   input.Limit,
		Cursor:  input.Cursor,
	}
	if !input.From.IsZero() {
		slotFrom := input.From
		listInput.SlotFrom = &slotFrom
	}
	if !input.To.IsZero() {
		slotTo := input.To
		listInput.SlotTo = &slotTo
	}

	page, err := handler.bookings.AdminList(ctx, listInput)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}

	now := time.Now()
	body := bookingsPage{
		Counts: bookingSegmentCounts{
			Active:              page.Counts.Active,
			ActiveHasEscalation: page.Counts.ActiveHasEscalation,
			Cancelled:           page.Counts.Cancelled,
			Completed:           page.Counts.Completed,
		},
		IsAcrossSegments: page.IsAcrossSegments,
		Items:            make([]bookingListItem, len(page.Items)),
		Total:            page.Total,
	}
	for index, item := range page.Items {
		body.Items[index] = bookingListItem{
			AmountPaise:   item.Amount.Paise(),
			Area:          item.City,
			CustomerName:  item.CustomerName,
			CustomerPhone: item.CustomerPhone,
			ID:            item.BookingID.String(),
			// No admin-asserted completion mechanism exists yet, so nothing is admin-verified.
			IsAdminVerified: false,
			ProviderName:    item.TechnicianName,
			ProviderNote:    adminProviderNote(item, now),
			Reference:       adminBookingReference(item.BookingID),
			ServiceName:     item.ServiceName,
			SlotAt:          item.SlotAt,
			State:           bookingState(item.State.String()),
		}
	}
	if page.NextCursor != "" {
		nextCursor := page.NextCursor
		body.NextCursor = &nextCursor
	}
	return &bookingsPageOutput{Body: body}, nil
}

// adminProviderNote derives the trailing provider line from the booking's state and how long
// it has been there. Variants the platform has no data for yet (an ETA needs live technician
// location) simply do not occur.
func adminProviderNote(item booking.AdminListItem, now time.Time) providerNote {
	minutesSince := func(since time.Time) *int32 {
		minutes := int32(now.Sub(since).Minutes())
		if minutes < 0 {
			minutes = 0
		}
		return &minutes
	}
	switch item.State {
	case booking.StateSearching, booking.StateEscalated:
		return providerNote{Kind: providerNoteKindUnassignedFor, Minutes: minutesSince(item.StateSince)}
	case booking.StateArrived:
		return providerNote{Kind: providerNoteKindArrivedAgo, Minutes: minutesSince(item.StateSince)}
	case booking.StateInProgress:
		startedAt := item.StateSince
		return providerNote{Kind: providerNoteKindStartedAt, At: &startedAt}
	case booking.StateCompleted:
		if item.ReviewRating != nil {
			rating := float64(*item.ReviewRating)
			return providerNote{Kind: providerNoteKindRating, Rating: &rating}
		}
		return providerNote{Kind: providerNoteKindNone}
	case booking.StateDraft, booking.StateConfirmed, booking.StateAssigned, booking.StateEnRoute,
		booking.StateAwaitingCompletion, booking.StateRescheduled, booking.StateCancelled, booking.StateFailed:
		return providerNote{Kind: providerNoteKindNone}
	}
	return providerNote{Kind: providerNoteKindNone}
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

func (handler *AdminHandler) getBooking(ctx context.Context, input *opsGetBookingInput) (*bookingDetailOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	detail, err := handler.bookings.AdminDetailByID(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err) // classify maps ErrBookingNotFound to 404
	}
	// The payment panel composes a second read from the money side — the ledger owns the
	// payments/REVENUE records and booking (a core) must not reach into them.
	facts, err := handler.ledger.PaymentFactsForBooking(ctx, detail.BookingID, detail.OrderID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}

	body := bookingDetail{
		AdminActivity: []bookingAdminActivity{},
		AmountPaise:   detail.Amount.Paise(),
		Area:          detail.City,
		CreatedAt:     detail.CreatedAt,
		Customer: bookingCustomer{
			Address:      detail.AddressLine1 + ", " + detail.City + " " + detail.Pincode,
			BookingCount: detail.CustomerBookingCount,
			JoinedAt:     detail.CustomerSince,
			Name:         detail.CustomerName,
			Phone:        detail.CustomerPhone,
		},
		// No auto-dispatch engine exists yet: zero rounds and zero declines are the truth,
		// not placeholders. Notes and admin-verified completions have no storage yet either.
		DeclinedTotal:   0,
		DispatchRounds:  []dispatchRound{},
		ID:              detail.BookingID.String(),
		IsAdminVerified: false,
		Notes:           []string{},
		Payment:         adminPaymentDTO(detail, facts),
		Reference:       adminBookingReference(detail.BookingID),
		ServiceTitle:    detail.ServiceName,
		State:           bookingState(detail.State.String()),
		Version:         int32(detail.Version),
	}

	// The timeline opens with the booking's creation (creation is not a transition, so
	// booking_events has no row for it) and then maps every recorded transition the console
	// vocabulary can name.
	timeline := make([]bookingEvent, 0, len(detail.Timeline)+1)
	timeline = append(timeline, bookingEvent{
		At:   detail.CreatedAt,
		ID:   detail.BookingID.String(),
		Kind: bookingEventKindCreated,
	})
	var startedAt, completedAt, escalatedAt *time.Time
	for _, entry := range detail.Timeline {
		kind, mapped := adminTimelineKind(entry)
		entryAt := entry.At
		switch entry.Action {
		case booking.ActionVerifyStart:
			startedAt = &entryAt
		case booking.ActionVerifyCompletion:
			completedAt = &entryAt
		case booking.ActionEscalate:
			escalatedAt = &entryAt
		case booking.ActionConfirm, booking.ActionSearch, booking.ActionAssign, booking.ActionDepart,
			booking.ActionArrive, booking.ActionRequestCompletion, booking.ActionResume,
			booking.ActionReschedule, booking.ActionCancel, booking.ActionFail:
			// No marker to record for these.
		}
		if !mapped {
			continue
		}
		event := bookingEvent{At: entry.At, ID: entry.EventID.String(), Kind: kind}
		if entry.ActorName != nil {
			event.ActorName = *entry.ActorName
		}
		if kind == bookingEventKindAutoAssigned && detail.TechnicianName != nil {
			// booking_events does not record which technician an ASSIGN placed; the current
			// assignee is the best available answer.
			event.ProviderName = *detail.TechnicianName
		}
		timeline = append(timeline, event)

		if kind == bookingEventKindEscalated {
			body.AdminActivity = append(body.AdminActivity, bookingAdminActivity{
				At:   entry.At,
				ID:   entry.EventID.String(),
				Kind: bookingAdminActivityKindSystemEscalated,
			})
		}
	}
	body.Timeline = timeline

	if detail.TechnicianID != nil {
		provider := bookingProvider{
			CompletedAt: completedAt,
			ID:          detail.TechnicianID.String(),
			Rating:      detail.TechnicianRating,
			StartedAt:   startedAt,
		}
		if detail.TechnicianName != nil {
			provider.Name = *detail.TechnicianName
		}
		body.Provider = nullable[bookingProvider]{Value: &provider}
	}
	if detail.State == booking.StateEscalated {
		since := detail.CreatedAt
		if escalatedAt != nil {
			since = *escalatedAt
		}
		minutes := int32(time.Since(since).Minutes())
		if minutes < 0 {
			minutes = 0
		}
		body.Escalation = nullable[bookingEscalation]{Value: &bookingEscalation{
			Declined:          0,
			MinutesUnresolved: minutes,
			Rounds:            0,
		}}
	}
	return &bookingDetailOutput{Body: body}, nil
}

// adminPaymentDTO fills the (non-nullable) payment panel. When no payment record exists yet —
// most in-flight bookings — the quoted amount is reported with an empty method and a zero
// paidAt: the contract has no "no payment yet" variant, so absence is encoded as zero values
// rather than invented data.
func adminPaymentDTO(detail booking.AdminDetail, facts ledger.PaymentFacts) bookingPayment {
	payment := bookingPayment{
		AmountPaise: detail.Amount.Paise(),
		IsPrepaid:   false, // payment always follows completion on this platform
		Last4:       "",    // card rails do not exist; UPI/cash carry no last-four
	}
	if !facts.Found {
		return payment
	}
	payment.AmountPaise = facts.Amount.Paise()
	payment.Method = paymentMethod(facts.Method.String())
	payment.TransactionID = facts.TransactionID
	if facts.PaidAt != nil {
		payment.PaidAt = *facts.PaidAt
	}
	return payment
}

// adminTimelineKind maps a recorded transition to the console's timeline vocabulary. ASSIGN
// maps to autoAssigned — the vocabulary's only assignment kind — with the acting admin named
// on the event; transitions outside the vocabulary (CONFIRM, REQUEST_COMPLETION, RESUME,
// RESCHEDULE) are omitted from the timeline.
func adminTimelineKind(entry booking.AdminTimelineEntry) (bookingEventKind, bool) {
	switch entry.Action {
	case booking.ActionSearch:
		return bookingEventKindSearching, true
	case booking.ActionAssign:
		return bookingEventKindAutoAssigned, true
	case booking.ActionDepart:
		return bookingEventKindEnRoute, true
	case booking.ActionArrive:
		return bookingEventKindArrived, true
	case booking.ActionVerifyStart:
		return bookingEventKindStarted, true
	case booking.ActionVerifyCompletion:
		if entry.ActorRole != nil && *entry.ActorRole == identity.RoleAdmin.String() {
			return bookingEventKindCompletedByAdmin, true
		}
		return bookingEventKindCompleted, true
	case booking.ActionEscalate:
		return bookingEventKindEscalated, true
	case booking.ActionCancel:
		return bookingEventKindCancelled, true
	case booking.ActionFail:
		return bookingEventKindAssignmentFailed, true
	case booking.ActionConfirm, booking.ActionRequestCompletion, booking.ActionResume, booking.ActionReschedule:
		return "", false
	}
	return "", false
}
