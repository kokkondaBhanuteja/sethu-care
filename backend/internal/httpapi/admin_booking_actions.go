package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// What an operator can DO to a booking. Every action is paired with a *-context read: the console
// never computes a policy amount, a cap or a lock for itself, so the server states them first and
// the form is built from the answer. Undo is a compensating, separately audited action rather than
// a client-side rollback.

func (handler *AdminHandler) registerAdminBookingActions(api huma.API) {
	notFound := adminResponse{"404", "Not Found", adminError{}}
	stale := adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}}

	huma.Register(api, huma.Operation{
		OperationID: "opsAssignContext", Method: http.MethodGet, Path: "/ops/bookings/{id}/assign-context",
		Summary: "Candidates, dispatch rounds and the ranking weights behind them", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.assignContext)

	huma.Register(api, huma.Operation{
		OperationID: "opsUndoAssign", Method: http.MethodPost, Path: "/ops/bookings/{id}/assign/undo",
		Summary: "Compensate an assignment inside the 30s window", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, stale),
	}, handler.undoAssign)

	huma.Register(api, huma.Operation{
		OperationID: "opsCancelContext", Method: http.MethodGet, Path: "/ops/bookings/{id}/cancel-context",
		Summary: "Refund policy and on-site state behind a cancellation", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.cancelContext)

	huma.Register(api, huma.Operation{
		OperationID: "opsCancelBooking", Method: http.MethodPost, Path: "/ops/bookings/{id}/cancel",
		Summary: "Cancel a booking", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound,
			adminResponse{"409", "Conflict — stale version, or the booking is already terminal", staleVersionError{}},
			adminResponse{"422", "Validation — a refund override needs its justification", adminError{}},
		),
	}, handler.cancelBooking)

	huma.Register(api, huma.Operation{
		OperationID: "opsUndoCancel", Method: http.MethodPost, Path: "/ops/bookings/{id}/cancel/undo",
		Summary: "Compensate a cancellation inside the 10s window", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, stale),
	}, handler.undoCancel)

	huma.Register(api, huma.Operation{
		OperationID: "opsManualCompletionContext", Method: http.MethodGet, Path: "/ops/bookings/{id}/manual-complete-context",
		Summary: "The lock, the evidence and the frequency counters behind a manual completion", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.manualCompletionContext)

	huma.Register(api, huma.Operation{
		OperationID: "opsManualCompleteBooking", Method: http.MethodPost, Path: "/ops/bookings/{id}/manual-complete",
		Summary: "Assert a completion the customer's OTP never proved", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound,
			adminResponse{"409", "Too early — the 30-minute lock still holds", manualCompleteTooEarlyError{}},
			adminResponse{"422", "Evidence insufficient", manualCompleteEvidenceError{}},
		),
	}, handler.manualCompleteBooking)

	huma.Register(api, huma.Operation{
		OperationID: "opsRedispatchContext", Method: http.MethodGet, Path: "/ops/bookings/{id}/redispatch-context",
		Summary: "Rounds, incentive cap and cycle count behind a redispatch", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.redispatchContext)

	huma.Register(api, huma.Operation{
		OperationID: "opsRedispatchBooking", Method: http.MethodPost, Path: "/ops/bookings/{id}/redispatch",
		Summary: "Re-run automation with widened parameters", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, stale),
	}, handler.redispatchBooking)

	huma.Register(api, huma.Operation{
		OperationID: "opsRefundContext", Method: http.MethodGet, Path: "/ops/bookings/{id}/refund-context",
		Summary: "Refundable amount, goodwill cap and rate-limit state behind a refund", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.refundContext)

	huma.Register(api, huma.Operation{
		OperationID: "opsRefundBooking", Method: http.MethodPost, Path: "/ops/bookings/{id}/refund",
		Summary: "Refund or credit a booking", Tags: []string{"Ops Booking Actions"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, stale,
			adminResponse{"202", "Accepted — the gateway has not confirmed; isPending is true", refundReceipt{}},
			adminResponse{"422", "Exceeds the goodwill cap", refundCapError{}},
			adminResponse{"429", "Refund rate limit reached", rateLimitedError{}},
		),
	}, handler.refundBooking)
}

// ------------------------------------------------------------ shared shapes

// BookingActionReceipt is what every mutation hands back. Exported because refundReceipt and
// cancelUndoReceipt embed it, and Go's embedding only carries exported fields.
type BookingActionReceipt struct {
	BookingID string `json:"bookingId" required:"true"`
	Version   int32  `json:"version" required:"true" doc:"The record's version after the mutation."`
}

// bookingActionSubject is the record header every action screen restates, so the operator never
// loses the subject. The payment method travels as a code; the console words it.
type bookingActionSubject struct {
	AmountPaise      int64         `json:"amountPaise" required:"true"`
	BookingID        string        `json:"bookingId" required:"true"`
	CreatedAtIso     time.Time     `json:"createdAtIso" required:"true"`
	CustomerName     string        `json:"customerName" required:"true"`
	EscalatedMinutes *int32        `json:"escalatedMinutes" required:"true"`
	PaymentMethod    paymentMethod `json:"paymentMethod" required:"true"`
	ProviderName     *string       `json:"providerName" required:"true"`
	Reference        string        `json:"reference" required:"true"`
	ServiceName      string        `json:"serviceName" required:"true"`
	Version          int32         `json:"version" required:"true"`
	Zone             string        `json:"zone" required:"true"`
}

// undoTarget names the action a compensating request undoes.
type undoTarget string

const (
	undoTargetAssign undoTarget = "assign"
	undoTargetCancel undoTarget = "cancel"
)

// Schema names the undo vocabulary in the generated document.
func (undoTarget) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "UndoTarget", "",
		string(undoTargetAssign), string(undoTargetCancel))
}

// undoRequest is a compensating, separately audited action rather than a client-side rollback —
// it names the action it undoes and carries its own idempotency key.
type undoRequest struct {
	Undoes  undoTarget `json:"undoes" required:"true"`
	Version int32      `json:"version" required:"true"`
}

type opsBookingActionPath struct {
	ID string `path:"id" doc:"Booking id"`
}

type bookingActionReceiptOutput struct {
	Body BookingActionReceipt
}

// ------------------------------------------------------------------ assign

type candidateAvailability string

const (
	candidateAvailabilityAvailable candidateAvailability = "available"
	candidateAvailabilityOnJob     candidateAvailability = "onJob"
	candidateAvailabilityDeclined  candidateAvailability = "declined"
)

// Schema names the candidate-availability vocabulary in the generated document.
func (candidateAvailability) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "CandidateAvailability", "",
		string(candidateAvailabilityAvailable), string(candidateAvailabilityOnJob), string(candidateAvailabilityDeclined))
}

type providerCandidate struct {
	Availability   candidateAvailability `json:"availability" required:"true"`
	CompletionRate float64               `json:"completionRate" required:"true" doc:"0–1. Never multiplied at the call site."`
	DeclinedAtIso  *time.Time            `json:"declinedAtIso" required:"true"`
	DistanceKm     float64               `json:"distanceKm" required:"true"`
	EtaMinutes     int32                 `json:"etaMinutes" required:"true"`
	FreeAtIso      *time.Time            `json:"freeAtIso" required:"true"`
	IsBestMatch    bool                  `json:"isBestMatch" required:"true"`
	JobsToday      int32                 `json:"jobsToday" required:"true"`
	Name           string                `json:"name" required:"true"`
	ProviderID     string                `json:"providerId" required:"true"`
	Rating         float64               `json:"rating" required:"true"`
	Skill          *string               `json:"skill" required:"true" doc:"The catalogue skill that matched, or null."`
}

// rankingWeight is what the ranking weighted. An override is only safe if the operator can see
// what they are overriding.
type rankingWeight struct {
	FactorID string  `json:"factorId" required:"true"`
	Weight   float64 `json:"weight" required:"true" doc:"0–1, so the client owns the presentation."`
}

type assignContext struct {
	Booking          bookingActionSubject `json:"booking" required:"true"`
	Candidates       []providerCandidate  `json:"candidates" required:"true" nullable:"false"`
	DeclinedCount    int32                `json:"declinedCount" required:"true"`
	IsBlockedOffline bool                 `json:"isBlockedOffline" required:"true" doc:"The server itself refuses to serve a stale candidate list."`
	RankingWeights   []rankingWeight      `json:"rankingWeights" required:"true" nullable:"false"`
	Rounds           []dispatchRound      `json:"rounds" required:"true" nullable:"false"`
}

type assignContextOutput struct {
	Body assignContext
}

func (handler *AdminHandler) assignContext(_ context.Context, _ *opsBookingActionPath) (*assignContextOutput, error) {
	return nil, notImplemented("opsAssignContext")
}

type opsUndoInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body undoRequest
}

func (handler *AdminHandler) undoAssign(_ context.Context, _ *opsUndoInput) (*bookingActionReceiptOutput, error) {
	return nil, notImplemented("opsUndoAssign")
}

// ------------------------------------------------------------------ cancel

// cancelReasonCode — 'Customer requested' is deliberately absent: after the 60-second window a
// customer request arrives as a support ticket, not an ops cancellation. safety_concern and
// fraud_suspected route into a safety review rather than a plain refund.
type cancelReasonCode string

const (
	cancelReasonCodeCustomerUnreachable cancelReasonCode = "customer_unreachable"
	cancelReasonCodeDuplicateBooking    cancelReasonCode = "duplicate_booking"
	cancelReasonCodeNoProviderAvailable cancelReasonCode = "no_provider_available"
	cancelReasonCodePricingDispute      cancelReasonCode = "pricing_dispute"
	cancelReasonCodeSafetyConcern       cancelReasonCode = "safety_concern"
	cancelReasonCodeTestInternal        cancelReasonCode = "test_internal"
	cancelReasonCodeFraudSuspected      cancelReasonCode = "fraud_suspected"
	cancelReasonCodeOther               cancelReasonCode = "other"
	cancelReasonCodeOutOfServiceArea    cancelReasonCode = "out_of_service_area"
)

// Schema names the cancellation-reason vocabulary in the generated document.
func (cancelReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "CancelReasonCode",
		"'Customer requested' is deliberately absent: after the 60-second window a customer request arrives as a support ticket, not an ops cancellation. safety_concern and fraud_suspected route into a safety review rather than a plain refund.",
		string(cancelReasonCodeCustomerUnreachable), string(cancelReasonCodeDuplicateBooking),
		string(cancelReasonCodeNoProviderAvailable), string(cancelReasonCodePricingDispute),
		string(cancelReasonCodeSafetyConcern), string(cancelReasonCodeTestInternal),
		string(cancelReasonCodeFraudSuspected), string(cancelReasonCodeOther),
		string(cancelReasonCodeOutOfServiceArea))
}

type cancelRefundInstruction struct {
	AmountPaise           int64  `json:"amountPaise" required:"true"`
	IsPolicyAmount        bool   `json:"isPolicyAmount" required:"true"`
	OverrideJustification string `json:"overrideJustification" required:"true" doc:"Separately audited when the amount departs from the policy amount."`
	WaiveFee              bool   `json:"waiveFee" required:"true"`
}

type cancelBookingRequest struct {
	Note       string                  `json:"note" required:"true"`
	ReasonCode cancelReasonCode        `json:"reasonCode" required:"true"`
	Refund     cancelRefundInstruction `json:"refund" required:"true"`
	Version    int32                   `json:"version" required:"true"`
}

type cancelContext struct {
	Booking              bookingActionSubject `json:"booking" required:"true"`
	CancellationFeePaise int64                `json:"cancellationFeePaise" required:"true"`
	IsPolicyRefundFull   bool                 `json:"isPolicyRefundFull" required:"true"`
	PolicyRefundPaise    int64                `json:"policyRefundPaise" required:"true"`
	TechnicianOnSite     bool                 `json:"technicianOnSite" required:"true" doc:"Cancelling mid-visit strands two people; the design puts an escape hatch above the form."`
}

// cancelUndoReceipt — the cancel compensation must also reverse the refund the cancellation
// initiated, or say it could not.
type cancelUndoReceipt struct {
	BookingActionReceipt
	RefundReversalFailureReason *string `json:"refundReversalFailureReason" required:"true" doc:"Set when the refund could not be reversed; the console says so rather than implying it was."`
	RefundReversed              bool    `json:"refundReversed" required:"true"`
}

type cancelContextOutput struct {
	Body cancelContext
}

func (handler *AdminHandler) cancelContext(_ context.Context, _ *opsBookingActionPath) (*cancelContextOutput, error) {
	return nil, notImplemented("opsCancelContext")
}

type opsCancelBookingInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body cancelBookingRequest
}

func (handler *AdminHandler) cancelBooking(_ context.Context, _ *opsCancelBookingInput) (*bookingActionReceiptOutput, error) {
	return nil, notImplemented("opsCancelBooking")
}

type cancelUndoOutput struct {
	Body cancelUndoReceipt
}

func (handler *AdminHandler) undoCancel(_ context.Context, _ *opsUndoInput) (*cancelUndoOutput, error) {
	return nil, notImplemented("opsUndoCancel")
}

// -------------------------------------------------------- manual completion

type manualCompletionReasonCode string

const (
	manualCompletionReasonCodePhoneUnreachable manualCompletionReasonCode = "customer_phone_unreachable"
	manualCompletionReasonCodeLeftPremises     manualCompletionReasonCode = "customer_left_premises"
	manualCompletionReasonCodeNoSignal         manualCompletionReasonCode = "customer_device_no_signal"
	manualCompletionReasonCodeRefusesOTP       manualCompletionReasonCode = "customer_refuses_otp"
	manualCompletionReasonCodeDeliveryFailure  manualCompletionReasonCode = "otp_delivery_failure"
	manualCompletionReasonCodeOther            manualCompletionReasonCode = "other"
)

// Schema names the manual-completion reason vocabulary in the generated document.
func (manualCompletionReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ManualCompletionReasonCode", "",
		string(manualCompletionReasonCodePhoneUnreachable), string(manualCompletionReasonCodeLeftPremises),
		string(manualCompletionReasonCodeNoSignal), string(manualCompletionReasonCodeRefusesOTP),
		string(manualCompletionReasonCodeDeliveryFailure), string(manualCompletionReasonCodeOther))
}

type manualCompletionAttestations struct {
	AttemptedCustomer bool `json:"attemptedCustomer" required:"true"`
	BelievesWorkDone  bool `json:"believesWorkDone" required:"true"`
	SpokeToProvider   bool `json:"spokeToProvider" required:"true"`
}

type manualCompletionEvidenceRefs struct {
	CallAttemptIDs     []string `json:"callAttemptIds" required:"true" nullable:"false"`
	CompletionReportID *string  `json:"completionReportId" required:"true"`
	WorkPhotoIDs       []string `json:"workPhotoIds" required:"true" nullable:"false"`
}

type manualCompleteRequest struct {
	Attestations manualCompletionAttestations `json:"attestations" required:"true"`
	Evidence     manualCompletionEvidenceRefs `json:"evidence" required:"true"`
	Note         string                       `json:"note" required:"true" doc:"At least 20 characters — server-enforced."`
	ReasonCode   manualCompletionReasonCode   `json:"reasonCode" required:"true"`
	Version      int32                        `json:"version" required:"true"`
}

type callAttempt struct {
	AtIso           time.Time `json:"atIso" required:"true"`
	DurationSeconds int32     `json:"durationSeconds" required:"true"`
	ID              string    `json:"id" required:"true"`
	Outcome         string    `json:"outcome" required:"true"`
}

type manualCompletionEvidence struct {
	CallAttempts          []callAttempt `json:"callAttempts" required:"true" nullable:"false"`
	CompletionReportAtIso *time.Time    `json:"completionReportAtIso" required:"true"`
	CompletionReportID    *string       `json:"completionReportId" required:"true"`
	WorkPhotoIDs          []string      `json:"workPhotoIds" required:"true" nullable:"false"`
}

type manualCompletionContext struct {
	AdminCompletionsThisWeek       int32                    `json:"adminCompletionsThisWeek" required:"true"`
	AvailableInMinutes             *int32                   `json:"availableInMinutes" required:"true" doc:"Non-null while the server's 30-minute lock still holds."`
	Booking                        bookingActionSubject     `json:"booking" required:"true"`
	Evidence                       manualCompletionEvidence `json:"evidence" required:"true"`
	MinutesSinceWorkReported       int32                    `json:"minutesSinceWorkReported" required:"true"`
	OtpArrivedAtIso                *time.Time               `json:"otpArrivedAtIso" required:"true" doc:"Set when the customer supplied the OTP mid-flow — the manual path yields."`
	ProviderCompletionsInSevenDays int32                    `json:"providerCompletionsInSevenDays" required:"true"`
	ProviderName                   string                   `json:"providerName" required:"true"`
	WorkReportedAtIso              time.Time                `json:"workReportedAtIso" required:"true"`
}

// manualCompleteTooEarlyError — the 30-minute lock is server-enforced; the console mirrors it for
// UX only.
type manualCompleteTooEarlyError struct {
	AvailableAt time.Time `json:"availableAt" required:"true" doc:"When the 30-minute lock lifts."`
	Code        string    `json:"code" required:"true" doc:"Always TOO_EARLY."`
	Message     string    `json:"message" required:"true"`
}

type manualCompleteEvidenceError struct {
	Code    string   `json:"code" required:"true" doc:"Always EVIDENCE_INSUFFICIENT."`
	Message string   `json:"message" required:"true"`
	Missing []string `json:"missing" required:"true" nullable:"false" doc:"Names the evidence still owed, so the UI can point at it."`
}

type manualCompletionContextOutput struct {
	Body manualCompletionContext
}

func (handler *AdminHandler) manualCompletionContext(_ context.Context, _ *opsBookingActionPath) (*manualCompletionContextOutput, error) {
	return nil, notImplemented("opsManualCompletionContext")
}

type opsManualCompleteInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body manualCompleteRequest
}

func (handler *AdminHandler) manualCompleteBooking(_ context.Context, _ *opsManualCompleteInput) (*bookingActionReceiptOutput, error) {
	return nil, notImplemented("opsManualCompleteBooking")
}

// -------------------------------------------------------------- redispatch

type redispatchRadius string

const (
	redispatchRadiusBase     redispatchRadius = "base"
	redispatchRadiusPlus50   redispatchRadius = "plus_50"
	redispatchRadiusPlus100  redispatchRadius = "plus_100"
	redispatchRadiusCityWide redispatchRadius = "city_wide"
)

// Schema names the redispatch-radius vocabulary in the generated document.
func (redispatchRadius) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RedispatchRadius", "",
		string(redispatchRadiusBase), string(redispatchRadiusPlus50),
		string(redispatchRadiusPlus100), string(redispatchRadiusCityWide))
}

type redispatchRequest struct {
	IncentivePaise   int64            `json:"incentivePaise" required:"true"`
	IncludeDecliners bool             `json:"includeDecliners" required:"true"`
	PriorityBoost    bool             `json:"priorityBoost" required:"true"`
	RadiusID         redispatchRadius `json:"radiusId" required:"true"`
	RelaxSkillMatch  bool             `json:"relaxSkillMatch" required:"true"`
	Version          int32            `json:"version" required:"true"`
}

type redispatchContext struct {
	Booking               bookingActionSubject `json:"booking" required:"true"`
	DeclinedCount         int32                `json:"declinedCount" required:"true"`
	DefaultIncentivePaise int64                `json:"defaultIncentivePaise" required:"true"`
	DefaultRadiusID       redispatchRadius     `json:"defaultRadiusId" required:"true"`
	FailedCycles          int32                `json:"failedCycles" required:"true" doc:"3 means automation has exhausted itself and the design demotes the primary button."`
	IncentiveCapPaise     int64                `json:"incentiveCapPaise" required:"true"`
	Rounds                []dispatchRound      `json:"rounds" required:"true" nullable:"false"`
}

type redispatchContextOutput struct {
	Body redispatchContext
}

func (handler *AdminHandler) redispatchContext(_ context.Context, _ *opsBookingActionPath) (*redispatchContextOutput, error) {
	return nil, notImplemented("opsRedispatchContext")
}

type opsRedispatchInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body redispatchRequest
}

func (handler *AdminHandler) redispatchBooking(_ context.Context, _ *opsRedispatchInput) (*bookingActionReceiptOutput, error) {
	return nil, notImplemented("opsRedispatchBooking")
}

// ------------------------------------------------------------------ refund

type refundPayoutImpact string

const (
	refundPayoutImpactWithhold  refundPayoutImpact = "withhold"
	refundPayoutImpactPayAnyway refundPayoutImpact = "pay_anyway"
)

// Schema names the payout-impact vocabulary in the generated document.
func (refundPayoutImpact) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RefundPayoutImpact", "",
		string(refundPayoutImpactWithhold), string(refundPayoutImpactPayAnyway))
}

type refundReasonCode string

const (
	refundReasonCodeServiceNotDelivered         refundReasonCode = "service_not_delivered"
	refundReasonCodeDuplicatePayment            refundReasonCode = "duplicate_payment"
	refundReasonCodePoorServiceQuality          refundReasonCode = "poor_service_quality"
	refundReasonCodeCancellationPolicyException refundReasonCode = "cancellation_policy_exception"
	refundReasonCodeProviderNoShow              refundReasonCode = "provider_no_show"
	refundReasonCodeGoodwillRetention           refundReasonCode = "goodwill_retention"
	refundReasonCodeOvercharged                 refundReasonCode = "overcharged"
	refundReasonCodeSafetyIncident              refundReasonCode = "safety_incident"
	refundReasonCodeOther                       refundReasonCode = "other"
)

// Schema names the refund-reason vocabulary in the generated document.
func (refundReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RefundReasonCode",
		"service_not_delivered, poor_service_quality, provider_no_show and safety_incident withhold the provider payout by default.",
		string(refundReasonCodeServiceNotDelivered), string(refundReasonCodeDuplicatePayment),
		string(refundReasonCodePoorServiceQuality), string(refundReasonCodeCancellationPolicyException),
		string(refundReasonCodeProviderNoShow), string(refundReasonCodeGoodwillRetention),
		string(refundReasonCodeOvercharged), string(refundReasonCodeSafetyIncident),
		string(refundReasonCodeOther))
}

type refundType string

const (
	refundTypeFull           refundType = "full"
	refundTypePartial        refundType = "partial"
	refundTypeWalletCredit   refundType = "wallet_credit"
	refundTypeGoodwillCredit refundType = "goodwill_credit"
	refundTypeWaiveFee       refundType = "waive_fee"
)

// Schema names the refund-type vocabulary in the generated document.
func (refundType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RefundType",
		"wallet_credit, goodwill_credit and waive_fee land immediately; card and UPI reversals take the banking week.",
		string(refundTypeFull), string(refundTypePartial), string(refundTypeWalletCredit),
		string(refundTypeGoodwillCredit), string(refundTypeWaiveFee))
}

type refundRequest struct {
	AmountPaise  int64              `json:"amountPaise" required:"true"`
	Note         string             `json:"note" required:"true"`
	PayoutImpact refundPayoutImpact `json:"payoutImpact" required:"true"`
	ReasonCode   refundReasonCode   `json:"reasonCode" required:"true"`
	RefundType   refundType         `json:"refundType" required:"true"`
	Version      int32              `json:"version" required:"true"`
}

type refundReceipt struct {
	BookingActionReceipt
	EstimatedCompletionIso *time.Time `json:"estimatedCompletionIso" required:"true"`
	IsPending              bool       `json:"isPending" required:"true" doc:"True on a 202: the gateway has not confirmed. A pending refund is never reported as done."`
	RefundID               string     `json:"refundId" required:"true"`
}

type refundContext struct {
	AlreadyRefundedPaise  int64                `json:"alreadyRefundedPaise" required:"true"`
	Booking               bookingActionSubject `json:"booking" required:"true"`
	BookingValuePaise     int64                `json:"bookingValuePaise" required:"true"`
	DefaultPayoutImpact   refundPayoutImpact   `json:"defaultPayoutImpact" required:"true"`
	GoodwillCapPaise      int64                `json:"goodwillCapPaise" required:"true"`
	OriginalMethod        paymentMethod        `json:"originalMethod" required:"true"`
	PaidAtIso             time.Time            `json:"paidAtIso" required:"true"`
	ProviderPayoutPaise   int64                `json:"providerPayoutPaise" required:"true"`
	RateLimitResetsAtIso  *time.Time           `json:"rateLimitResetsAtIso" required:"true"`
	RefundablePaise       int64                `json:"refundablePaise" required:"true"`
	RefundsAllowedPerHour int32                `json:"refundsAllowedPerHour" required:"true"`
	RefundsUsedThisHour   int32                `json:"refundsUsedThisHour" required:"true"`
}

type refundCapError struct {
	CapPaise int64             `json:"capPaise" required:"true" doc:"The goodwill cap that was exceeded."`
	Code     string            `json:"code" required:"true" doc:"Always EXCEEDS_CAP."`
	Fields   map[string]string `json:"fields,omitempty" doc:"Carries a field error on amountPaise."`
	Message  string            `json:"message" required:"true"`
}

type refundContextOutput struct {
	Body refundContext
}

func (handler *AdminHandler) refundContext(_ context.Context, _ *opsBookingActionPath) (*refundContextOutput, error) {
	return nil, notImplemented("opsRefundContext")
}

type opsRefundInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body refundRequest
}

type refundReceiptOutput struct {
	Body refundReceipt
}

func (handler *AdminHandler) refundBooking(_ context.Context, _ *opsRefundInput) (*refundReceiptOutput, error) {
	return nil, notImplemented("opsRefundBooking")
}
