package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/rescue"
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

func (handler *AdminHandler) assignContext(ctx context.Context, input *opsBookingActionPath) (*assignContextOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	built, err := handler.rescue.AssignContext(ctx, bookingID)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}

	candidates := make([]providerCandidate, len(built.Candidates))
	for index, candidate := range built.Candidates {
		candidates[index] = providerCandidate{
			Availability:   candidateAvailability(candidate.Availability),
			CompletionRate: candidate.CompletionRate,
			DeclinedAtIso:  candidate.DeclinedAt,
			DistanceKm:     candidate.DistanceKm,
			EtaMinutes:     candidate.EtaMinutes,
			FreeAtIso:      candidate.FreeAt,
			IsBestMatch:    candidate.IsBestMatch,
			JobsToday:      candidate.JobsToday,
			Name:           candidate.Name,
			ProviderID:     candidate.ProviderID.String(),
			Rating:         candidate.Rating,
			Skill:          candidate.Skill,
		}
	}
	weights := make([]rankingWeight, len(built.RankingWeights))
	for index, weight := range built.RankingWeights {
		weights[index] = rankingWeight{FactorID: weight.FactorID, Weight: weight.Weight}
	}
	return &assignContextOutput{Body: assignContext{
		Booking:       adminActionSubjectDTO(built.Subject),
		Candidates:    candidates,
		DeclinedCount: built.DeclinedCount,
		// The server answered, so the candidate list is fresh by construction; a truly
		// offline console never reaches this handler.
		IsBlockedOffline: false,
		RankingWeights:   weights,
		Rounds:           adminDispatchRoundDTOs(built.Rounds),
	}}, nil
}

type opsUndoInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body undoRequest
}

func (handler *AdminHandler) undoAssign(ctx context.Context, input *opsUndoInput) (*bookingActionReceiptOutput, error) {
	actionInput, err := adminUndoActionInput(ctx, input, undoTargetAssign)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	receipt, err := handler.rescue.UndoAssign(ctx, actionInput)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &bookingActionReceiptOutput{Body: adminActionReceiptDTO(receipt)}, nil
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

func (handler *AdminHandler) cancelContext(ctx context.Context, input *opsBookingActionPath) (*cancelContextOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	built, err := handler.rescue.CancelContext(ctx, bookingID)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &cancelContextOutput{Body: cancelContext{
		Booking:              adminActionSubjectDTO(built.Subject),
		CancellationFeePaise: built.CancellationFee,
		IsPolicyRefundFull:   built.IsPolicyRefundFull,
		PolicyRefundPaise:    built.PolicyRefundPaise,
		TechnicianOnSite:     built.TechnicianOnSite,
	}}, nil
}

type opsCancelBookingInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body cancelBookingRequest
}

func (handler *AdminHandler) cancelBooking(ctx context.Context, input *opsCancelBookingInput) (*bookingActionReceiptOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	receipt, err := handler.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: rescue.ActionInput{
			BookingID:      bookingID,
			AdminID:        admin.ID,
			IdempotencyKey: input.IdempotencyKey,
			Version:        input.Body.Version,
		},
		ReasonCode:            string(input.Body.ReasonCode),
		Note:                  input.Body.Note,
		RefundAmount:          money.FromPaise(input.Body.Refund.AmountPaise),
		OverrideJustification: input.Body.Refund.OverrideJustification,
		WaiveFee:              input.Body.Refund.WaiveFee,
	})
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &bookingActionReceiptOutput{Body: adminActionReceiptDTO(receipt)}, nil
}

type cancelUndoOutput struct {
	Body cancelUndoReceipt
}

func (handler *AdminHandler) undoCancel(ctx context.Context, input *opsUndoInput) (*cancelUndoOutput, error) {
	actionInput, err := adminUndoActionInput(ctx, input, undoTargetCancel)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	receipt, err := handler.rescue.UndoCancel(ctx, actionInput)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &cancelUndoOutput{Body: cancelUndoReceipt{
		BookingActionReceipt:        adminActionReceiptDTO(receipt.Receipt),
		RefundReversalFailureReason: receipt.RefundReversalFailureReason,
		RefundReversed:              receipt.RefundReversed,
	}}, nil
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

func (handler *AdminHandler) manualCompletionContext(ctx context.Context, input *opsBookingActionPath) (*manualCompletionContextOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	built, err := handler.rescue.ManualCompletionContext(ctx, bookingID, admin.ID)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}

	attempts := make([]callAttempt, len(built.Evidence.CallAttempts))
	for index, attempt := range built.Evidence.CallAttempts {
		attempts[index] = callAttempt{
			AtIso:           attempt.At,
			DurationSeconds: attempt.Duration,
			ID:              attempt.ID,
			Outcome:         attempt.Outcome,
		}
	}
	photoIDs := make([]string, len(built.Evidence.WorkPhotoIDs))
	for index, photoID := range built.Evidence.WorkPhotoIDs {
		photoIDs[index] = photoID.String()
	}
	return &manualCompletionContextOutput{Body: manualCompletionContext{
		AdminCompletionsThisWeek: built.AdminCompletionsThisWeek,
		AvailableInMinutes:       built.AvailableInMinutes,
		Booking:                  adminActionSubjectDTO(built.Subject),
		Evidence: manualCompletionEvidence{
			CallAttempts:          attempts,
			CompletionReportAtIso: built.Evidence.CompletionReportAt,
			CompletionReportID:    built.Evidence.CompletionReportID,
			WorkPhotoIDs:          photoIDs,
		},
		MinutesSinceWorkReported:       built.MinutesSinceWorkReported,
		OtpArrivedAtIso:                built.OtpArrivedAt,
		ProviderCompletionsInSevenDays: built.ProviderCompletionsInSevenDays,
		ProviderName:                   built.ProviderName,
		WorkReportedAtIso:              built.WorkReportedAt,
	}}, nil
}

type opsManualCompleteInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body manualCompleteRequest
}

func (handler *AdminHandler) manualCompleteBooking(ctx context.Context, input *opsManualCompleteInput) (*bookingActionReceiptOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	receipt, err := handler.rescue.ManualComplete(ctx, rescue.ManualCompleteInput{
		ActionInput: rescue.ActionInput{
			BookingID:      bookingID,
			AdminID:        admin.ID,
			IdempotencyKey: input.IdempotencyKey,
			Version:        input.Body.Version,
		},
		ReasonCode: string(input.Body.ReasonCode),
		Note:       input.Body.Note,
		Attestations: rescue.ManualCompletionAttestations{
			AttemptedCustomer: input.Body.Attestations.AttemptedCustomer,
			BelievesWorkDone:  input.Body.Attestations.BelievesWorkDone,
			SpokeToProvider:   input.Body.Attestations.SpokeToProvider,
		},
		Evidence: rescue.ManualCompletionEvidenceRefs{
			CallAttemptIDs:     input.Body.Evidence.CallAttemptIDs,
			CompletionReportID: input.Body.Evidence.CompletionReportID,
			WorkPhotoIDs:       input.Body.Evidence.WorkPhotoIDs,
		},
	})
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &bookingActionReceiptOutput{Body: adminActionReceiptDTO(receipt)}, nil
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

func (handler *AdminHandler) redispatchContext(ctx context.Context, input *opsBookingActionPath) (*redispatchContextOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	built, err := handler.rescue.RedispatchContext(ctx, bookingID)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &redispatchContextOutput{Body: redispatchContext{
		Booking:               adminActionSubjectDTO(built.Subject),
		DeclinedCount:         built.DeclinedCount,
		DefaultIncentivePaise: built.DefaultIncentive,
		DefaultRadiusID:       redispatchRadius(built.DefaultRadius),
		FailedCycles:          built.FailedCycles,
		IncentiveCapPaise:     built.IncentiveCap,
		Rounds:                adminDispatchRoundDTOs(built.Rounds),
	}}, nil
}

type opsRedispatchInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body redispatchRequest
}

func (handler *AdminHandler) redispatchBooking(ctx context.Context, input *opsRedispatchInput) (*bookingActionReceiptOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	receipt, err := handler.rescue.Redispatch(ctx, rescue.RedispatchInput{
		ActionInput: rescue.ActionInput{
			BookingID:      bookingID,
			AdminID:        admin.ID,
			IdempotencyKey: input.IdempotencyKey,
			Version:        input.Body.Version,
		},
		RadiusID:         rescue.Radius(input.Body.RadiusID),
		IncentivePaise:   input.Body.IncentivePaise,
		RelaxSkillMatch:  input.Body.RelaxSkillMatch,
		IncludeDecliners: input.Body.IncludeDecliners,
		PriorityBoost:    input.Body.PriorityBoost,
	})
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &bookingActionReceiptOutput{Body: adminActionReceiptDTO(receipt)}, nil
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

func (handler *AdminHandler) refundContext(ctx context.Context, input *opsBookingActionPath) (*refundContextOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	built, err := handler.rescue.RefundContext(ctx, bookingID, admin.ID)
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &refundContextOutput{Body: refundContext{
		AlreadyRefundedPaise:  built.AlreadyRefundedPaise,
		Booking:               adminActionSubjectDTO(built.Subject),
		BookingValuePaise:     built.BookingValuePaise,
		DefaultPayoutImpact:   refundPayoutImpact(built.DefaultPayoutImpact),
		GoodwillCapPaise:      built.GoodwillCapPaise,
		OriginalMethod:        paymentMethod(built.OriginalMethod),
		PaidAtIso:             built.PaidAt,
		ProviderPayoutPaise:   built.ProviderPayoutPaise,
		RateLimitResetsAtIso:  built.RateLimitResetsAt,
		RefundablePaise:       built.RefundablePaise,
		RefundsAllowedPerHour: built.RefundsAllowedPerHour,
		RefundsUsedThisHour:   built.RefundsUsedThisHour,
	}}, nil
}

type opsRefundInput struct {
	ID string `path:"id" doc:"Booking id"`
	AdminIdempotency
	Body refundRequest
}

type refundReceiptOutput struct {
	Body refundReceipt
}

func (handler *AdminHandler) refundBooking(ctx context.Context, input *opsRefundInput) (*refundReceiptOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	receipt, err := handler.rescue.Refund(ctx, rescue.RefundInput{
		ActionInput: rescue.ActionInput{
			BookingID:      bookingID,
			AdminID:        admin.ID,
			IdempotencyKey: input.IdempotencyKey,
			Version:        input.Body.Version,
		},
		Amount:       money.FromPaise(input.Body.AmountPaise),
		ReasonCode:   string(input.Body.ReasonCode),
		RefundType:   string(input.Body.RefundType),
		PayoutImpact: string(input.Body.PayoutImpact),
		Note:         input.Body.Note,
	})
	if err != nil {
		return nil, adminActionError(handler.log, err)
	}
	return &refundReceiptOutput{Body: refundReceipt{
		BookingActionReceipt:   adminActionReceiptDTO(receipt.Receipt),
		EstimatedCompletionIso: receipt.EstimatedCompletionAt,
		IsPending:              receipt.IsPending,
		RefundID:               receipt.RefundID.String(),
	}}, nil
}

// --------------------------------------------------------------- shared mapping

// adminActionSubjectDTO maps the rescue subject onto the wire header every action screen
// restates.
func adminActionSubjectDTO(subject rescue.Subject) bookingActionSubject {
	return bookingActionSubject{
		AmountPaise:      subject.Amount.Paise(),
		BookingID:        subject.BookingID.String(),
		CreatedAtIso:     subject.CreatedAt,
		CustomerName:     subject.CustomerName,
		EscalatedMinutes: subject.EscalatedMinutes,
		// The empty method is the truth for a booking with no payment record yet — the
		// same encoding the detail screen's payment panel uses.
		PaymentMethod: paymentMethod(subject.PaymentMethod),
		ProviderName:  subject.ProviderName,
		Reference:     adminBookingReference(subject.BookingID),
		ServiceName:   subject.ServiceName,
		Version:       int32(subject.Version),
		Zone:          subject.Zone,
	}
}

func adminDispatchRoundDTOs(rounds []rescue.DispatchRound) []dispatchRound {
	built := make([]dispatchRound, len(rounds))
	for index, round := range rounds {
		built[index] = dispatchRound{
			Contacted: round.Contacted,
			Declined:  round.Declined,
			RadiusKm:  round.RadiusKm,
			Round:     round.Round,
		}
	}
	return built
}

func adminActionReceiptDTO(receipt rescue.Receipt) BookingActionReceipt {
	return BookingActionReceipt{BookingID: receipt.BookingID.String(), Version: receipt.Version}
}

// adminUndoActionInput decodes the pieces both undo endpoints share, and refuses a body
// whose `undoes` names the other action — a routing mistake worth a 400, not a silent undo.
func adminUndoActionInput(ctx context.Context, input *opsUndoInput, expected undoTarget) (rescue.ActionInput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return rescue.ActionInput{}, err
	}
	if input.Body.Undoes != expected {
		return rescue.ActionInput{}, &badRequestError{msg: "undoes must be \"" + string(expected) + "\" on this endpoint"}
	}
	admin, ok := userFromContext(ctx)
	if !ok {
		return rescue.ActionInput{}, &badRequestError{msg: "authentication required"}
	}
	return rescue.ActionInput{
		BookingID:      bookingID,
		AdminID:        admin.ID,
		IdempotencyKey: input.IdempotencyKey,
		Version:        input.Body.Version,
	}, nil
}

// ------------------------------------------------------- designed error bodies

// The rescue console renders dedicated states for its designed failures, so those arrive
// with the declared BODY shapes, not the generic error model. Each wrapper implements
// huma.StatusError: huma writes the wrapper itself as the response body. classify() stays
// the status authority for every error not special-cased here.
func adminActionError(log *slog.Logger, err error) error {
	var staleVersion *rescue.StaleVersionError
	if errors.As(err, &staleVersion) {
		return &staleVersionStatusError{staleVersionError{
			Code:           "VERSION_CONFLICT",
			CurrentVersion: staleVersion.CurrentVersion,
			Message:        "the record moved since it was read",
		}}
	}
	var tooEarly *rescue.TooEarlyError
	if errors.As(err, &tooEarly) {
		return &tooEarlyStatusError{manualCompleteTooEarlyError{
			AvailableAt: tooEarly.AvailableAt,
			Code:        "TOO_EARLY",
			Message:     "the 30-minute lock still holds",
		}}
	}
	var evidence *rescue.EvidenceError
	if errors.As(err, &evidence) {
		return &evidenceStatusError{manualCompleteEvidenceError{
			Code:    "EVIDENCE_INSUFFICIENT",
			Message: "the manual completion still owes evidence",
			Missing: evidence.Missing,
		}}
	}
	var capExceeded *rescue.CapExceededError
	if errors.As(err, &capExceeded) {
		return &capStatusError{refundCapError{
			CapPaise: capExceeded.Cap.Paise(),
			Code:     "EXCEEDS_CAP",
			Fields:   map[string]string{capExceeded.Field: "exceeds the cap"},
			Message:  capExceeded.Error(),
		}}
	}
	var rateLimit *rescue.RateLimitedError
	if errors.As(err, &rateLimit) {
		return &rateLimitStatusError{rateLimitedError{
			Code:    "RATE_LIMITED",
			Message: "refund rate limit reached",
			ResetAt: rateLimit.ResetAt,
		}}
	}
	var invalid *rescue.ValidationError
	if errors.As(err, &invalid) {
		return &validationStatusError{adminError{
			Code:    "VALIDATION",
			Fields:  map[string]string{invalid.Field: invalid.Message},
			Message: invalid.Error(),
		}}
	}
	return toHumaError(log, err)
}

type staleVersionStatusError struct{ staleVersionError }

func (statusErr *staleVersionStatusError) Error() string  { return statusErr.Message }
func (statusErr *staleVersionStatusError) GetStatus() int { return http.StatusConflict }

type tooEarlyStatusError struct{ manualCompleteTooEarlyError }

func (statusErr *tooEarlyStatusError) Error() string  { return statusErr.Message }
func (statusErr *tooEarlyStatusError) GetStatus() int { return http.StatusConflict }

type evidenceStatusError struct{ manualCompleteEvidenceError }

func (statusErr *evidenceStatusError) Error() string  { return statusErr.Message }
func (statusErr *evidenceStatusError) GetStatus() int { return http.StatusUnprocessableEntity }

type capStatusError struct{ refundCapError }

func (statusErr *capStatusError) Error() string  { return statusErr.Message }
func (statusErr *capStatusError) GetStatus() int { return http.StatusUnprocessableEntity }

type rateLimitStatusError struct{ rateLimitedError }

func (statusErr *rateLimitStatusError) Error() string  { return statusErr.Message }
func (statusErr *rateLimitStatusError) GetStatus() int { return http.StatusTooManyRequests }

type validationStatusError struct{ adminError }

func (statusErr *validationStatusError) Error() string  { return statusErr.Message }
func (statusErr *validationStatusError) GetStatus() int { return http.StatusUnprocessableEntity }
