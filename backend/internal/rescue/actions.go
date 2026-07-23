package rescue

// The mutations. Every one: replays its Idempotency-Key (the first receipt is returned
// instead of acting twice), pins the version the operator read, commands the OWNING service
// (booking.Apply for state, ledger for money) and records the replay receipt. State
// transitions are audited by booking.Apply itself; the money legs write their own trail
// entries inside the ledger's transaction.

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// Operation ids double as the replay-record key namespace and its recorded action name.
const (
	operationCancel         = "opsCancelBooking"
	operationUndoCancel     = "opsUndoCancel"
	operationUndoAssign     = "opsUndoAssign"
	operationRedispatch     = "opsRedispatchBooking"
	operationManualComplete = "opsManualCompleteBooking"
	operationRefund         = "opsRefundBooking"

	// refundAuditAction is the trail verb the refund rate limit counts.
	refundAuditAction = "REFUND"
)

// ActionInput is what every mutation carries: who acts, on what, under which
// operator-minted key, having read which version.
type ActionInput struct {
	BookingID      uuid.UUID
	AdminID        uuid.UUID
	IdempotencyKey string
	Version        int32
}

// Receipt is what every mutation hands back.
type Receipt struct {
	BookingID uuid.UUID `json:"bookingId"`
	Version   int32     `json:"version"`
}

// CancelUndoReceipt also reports whether the refund the cancellation initiated was
// reversed — or says it could not be, rather than implying it was.
type CancelUndoReceipt struct {
	Receipt
	RefundReversed              bool    `json:"refundReversed"`
	RefundReversalFailureReason *string `json:"refundReversalFailureReason"`
}

// RefundReceipt names the refund recorded. IsPending is always false on this platform:
// refunds land as immediate ledger credits — no gateway reversal rail exists yet.
type RefundReceipt struct {
	Receipt
	RefundID              uuid.UUID  `json:"refundId"`
	IsPending             bool       `json:"isPending"`
	EstimatedCompletionAt *time.Time `json:"estimatedCompletionAt"`
}

// recordReceipt stores the replay record after a mutation whose own guards (the version
// CAS) make a re-execution fail safely. A failure here surfaces as an error: the operator
// retries, the CAS refuses, and the re-read shows the action landed.
func (service *Service) recordReceipt(ctx context.Context, in ActionInput, operation string, keyID uuid.UUID, receipt any) error {
	if err := service.trail.RecordAdminAction(ctx, in.AdminID, operation, keyID, receipt); err != nil {
		return fmt.Errorf("rescue: the action was applied but its replay record failed: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------- cancel

// CancelInput is an admin emergency cancellation.
type CancelInput struct {
	ActionInput
	ReasonCode string
	Note       string
	// RefundAmount is the refund decision recorded with the cancellation; zero records no
	// money movement.
	RefundAmount money.Money
	// OverrideJustification is required whenever RefundAmount departs from the policy
	// amount; it is separately audited.
	OverrideJustification string
	WaiveFee              bool
}

// cancelEventMeta is the diagnostics the CANCEL transition records.
type cancelEventMeta struct {
	Cancel struct {
		ReasonCode  string `json:"reason_code"`
		Note        string `json:"note"`
		RefundPaise int64  `json:"refund_paise"`
		WaiveFee    bool   `json:"waive_fee"`
	} `json:"cancel"`
}

// Cancel cancels a booking as the admin, records the refund decision, and moves the refund
// money (if any) through the ledger.
func (service *Service) Cancel(ctx context.Context, in CancelInput) (Receipt, error) {
	var replayed Receipt
	keyID, found, err := service.replayInto(ctx, operationCancel, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return Receipt{}, err
	}
	if found {
		return replayed, nil
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return Receipt{}, err
	}
	// The version echo is checked FIRST: a stale read answers with the current version so
	// the console can re-read, whatever else has happened to the record since.
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return Receipt{}, err
	}
	switch rec.detail.State {
	case booking.StateCancelled, booking.StateCompleted, booking.StateFailed:
		return Receipt{}, &TerminalStateError{State: rec.detail.State.String()}
	case booking.StateDraft, booking.StateConfirmed, booking.StateSearching, booking.StateAssigned,
		booking.StateEnRoute, booking.StateArrived, booking.StateInProgress,
		booking.StateAwaitingCompletion, booking.StateEscalated, booking.StateRescheduled:
		// Cancellable in principle; the state machine has the final word below.
	}
	if in.RefundAmount.Paise() < 0 {
		return Receipt{}, &ValidationError{Field: "refund.amountPaise", Message: "a refund cannot be negative"}
	}
	if in.RefundAmount.Paise() > rec.detail.Amount.Paise() {
		return Receipt{}, &ValidationError{Field: "refund.amountPaise", Message: "exceeds the booking value"}
	}
	refundable, _, err := service.refundableFor(ctx, rec)
	if err != nil {
		return Receipt{}, err
	}
	if in.RefundAmount.Paise() != refundable.Paise() && in.OverrideJustification == "" {
		return Receipt{}, &ValidationError{
			Field:   "refund.overrideJustification",
			Message: "a refund that departs from the policy amount needs its justification",
		}
	}

	var meta cancelEventMeta
	meta.Cancel.ReasonCode = in.ReasonCode
	meta.Cancel.Note = in.Note
	meta.Cancel.RefundPaise = in.RefundAmount.Paise()
	meta.Cancel.WaiveFee = in.WaiveFee
	metaJSON, err := marshalMeta(meta)
	if err != nil {
		return Receipt{}, err
	}

	adminID := in.AdminID
	expected := rec.detail.Version
	if _, err := service.bookings.Apply(ctx, in.BookingID, booking.ActionCancel, booking.TransitionInput{
		Actor:           &adminID,
		ActorRole:       identity.RoleAdmin,
		Meta:            metaJSON,
		ExpectedVersion: &expected,
	}); err != nil {
		return Receipt{}, err
	}

	if in.RefundAmount.Paise() > 0 {
		auditDetail := map[string]string{
			"reason_code": in.ReasonCode,
			"is_policy":   fmt.Sprintf("%t", in.RefundAmount.Paise() == refundable.Paise()),
		}
		if in.OverrideJustification != "" {
			auditDetail["override_justification"] = in.OverrideJustification
		}
		if _, err := service.ledger.RecordAdminCredit(ctx, ledger.AdminCreditInput{
			CreditID:    uuid.New(),
			BookingID:   in.BookingID,
			AdminID:     in.AdminID,
			Amount:      in.RefundAmount,
			Memo:        "admin cancel refund — " + in.ReasonCode,
			AuditAction: "CANCEL_REFUND",
			AuditDetail: auditDetail,
		}); err != nil {
			// The cancellation committed; the refund leg did not. Surface it — the operator
			// records the refund from the refund screen rather than believing it happened.
			return Receipt{}, fmt.Errorf("rescue: the booking was cancelled but the refund could not be recorded: %w", err)
		}
	}

	receipt := Receipt{BookingID: in.BookingID, Version: int32(expected + 1)}
	if err := service.recordReceipt(ctx, in.ActionInput, operationCancel, keyID, receipt); err != nil {
		return Receipt{}, err
	}
	return receipt, nil
}

// UndoCancel compensates a cancellation inside its 10-second window: a real ESCALATE
// transition back into the human queue, plus an offsetting ledger entry for the refund the
// cancellation recorded.
func (service *Service) UndoCancel(ctx context.Context, in ActionInput) (CancelUndoReceipt, error) {
	var replayed CancelUndoReceipt
	keyID, found, err := service.replayInto(ctx, operationUndoCancel, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return CancelUndoReceipt{}, err
	}
	if found {
		return replayed, nil
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return CancelUndoReceipt{}, err
	}
	if rec.detail.State != booking.StateCancelled {
		return CancelUndoReceipt{}, &NotUndoableError{Undoes: "cancel", Reason: "the booking is not cancelled"}
	}
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return CancelUndoReceipt{}, err
	}
	cancelledAt := lastActionAt(rec.detail.Timeline, booking.ActionCancel)
	if cancelledAt == nil {
		return CancelUndoReceipt{}, &NotUndoableError{Undoes: "cancel", Reason: "no cancellation is recorded"}
	}
	if closesAt := cancelledAt.Add(UndoCancelWindow); time.Now().After(closesAt) {
		return CancelUndoReceipt{}, &UndoWindowClosedError{Undoes: "cancel", ClosedAt: closesAt}
	}

	if err := service.applyUndo(ctx, in, rec, "cancel"); err != nil {
		return CancelUndoReceipt{}, err
	}

	receipt := CancelUndoReceipt{Receipt: Receipt{BookingID: in.BookingID, Version: int32(rec.detail.Version + 1)}}
	reversed, reverseErr := service.ledger.ReverseLatestCreditForBooking(ctx, in.BookingID, in.AdminID, "admin cancel undone — refund reversed")
	switch {
	case reverseErr != nil:
		// The compensating transition committed; the money did not come back. Say so —
		// the console states it rather than implying the refund was reversed.
		reason := "the refund reversal could not be recorded; reverse it from the ledger"
		receipt.RefundReversalFailureReason = &reason
	case reversed:
		receipt.RefundReversed = true
	}

	if err := service.recordReceipt(ctx, in, operationUndoCancel, keyID, receipt); err != nil {
		return CancelUndoReceipt{}, err
	}
	return receipt, nil
}

// ------------------------------------------------------------------------ undo assign

// UndoAssign compensates a manual assignment inside its 30-second window: the booking
// ESCALATEs back into the rescue queue.
func (service *Service) UndoAssign(ctx context.Context, in ActionInput) (Receipt, error) {
	var replayed Receipt
	keyID, found, err := service.replayInto(ctx, operationUndoAssign, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return Receipt{}, err
	}
	if found {
		return replayed, nil
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return Receipt{}, err
	}
	if rec.detail.State != booking.StateAssigned {
		return Receipt{}, &NotUndoableError{Undoes: "assign", Reason: "the booking is not assigned"}
	}
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return Receipt{}, err
	}
	assignedAt := lastActionAt(rec.detail.Timeline, booking.ActionAssign)
	if assignedAt == nil {
		return Receipt{}, &NotUndoableError{Undoes: "assign", Reason: "no assignment is recorded"}
	}
	if closesAt := assignedAt.Add(UndoAssignWindow); time.Now().After(closesAt) {
		return Receipt{}, &UndoWindowClosedError{Undoes: "assign", ClosedAt: closesAt}
	}

	if err := service.applyUndo(ctx, in, rec, "assign"); err != nil {
		return Receipt{}, err
	}
	receipt := Receipt{BookingID: in.BookingID, Version: int32(rec.detail.Version + 1)}
	if err := service.recordReceipt(ctx, in, operationUndoAssign, keyID, receipt); err != nil {
		return Receipt{}, err
	}
	return receipt, nil
}

// undoEventMeta names the action a compensating ESCALATE undoes, on the event itself.
type undoEventMeta struct {
	Undo struct {
		Of string `json:"of"`
	} `json:"undo"`
}

// applyUndo runs the compensating ESCALATE transition, version-pinned and audited (by
// booking.Apply) like every other transition.
func (service *Service) applyUndo(ctx context.Context, in ActionInput, rec record, undoes string) error {
	var meta undoEventMeta
	meta.Undo.Of = undoes
	metaJSON, err := marshalMeta(meta)
	if err != nil {
		return err
	}
	adminID := in.AdminID
	expected := rec.detail.Version
	_, err = service.bookings.Apply(ctx, in.BookingID, booking.ActionEscalate, booking.TransitionInput{
		Actor:           &adminID,
		ActorRole:       identity.RoleAdmin,
		Meta:            metaJSON,
		ExpectedVersion: &expected,
	})
	return err
}

// ------------------------------------------------------------------------ redispatch

// RedispatchInput re-runs the automated search with widened parameters.
type RedispatchInput struct {
	ActionInput
	RadiusID         Radius
	IncentivePaise   int64
	RelaxSkillMatch  bool
	IncludeDecliners bool
	PriorityBoost    bool
}

// Redispatch RESUMEs an escalated booking into SEARCHING with the widened parameters
// recorded on the transition's booking_events row — the next context read reports them as
// a dispatch round.
func (service *Service) Redispatch(ctx context.Context, in RedispatchInput) (Receipt, error) {
	var replayed Receipt
	keyID, found, err := service.replayInto(ctx, operationRedispatch, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return Receipt{}, err
	}
	if found {
		return replayed, nil
	}

	if in.IncentivePaise < 0 {
		return Receipt{}, &ValidationError{Field: "incentivePaise", Message: "an incentive cannot be negative"}
	}
	if in.IncentivePaise > IncentiveCapPaise {
		return Receipt{}, &CapExceededError{Cap: money.FromPaise(IncentiveCapPaise), Field: "incentivePaise"}
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return Receipt{}, err
	}
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return Receipt{}, err
	}
	previousRounds, err := service.dispatchRounds(ctx, in.BookingID)
	if err != nil {
		return Receipt{}, err
	}

	var meta redispatchEventMeta
	meta.Redispatch = redispatchMetaBody{
		Round:            int32(len(previousRounds)) + 1,
		RadiusID:         string(in.RadiusID),
		RadiusKm:         in.RadiusID.KmOf(),
		IncentivePaise:   in.IncentivePaise,
		RelaxSkillMatch:  in.RelaxSkillMatch,
		IncludeDecliners: in.IncludeDecliners,
		PriorityBoost:    in.PriorityBoost,
	}
	metaJSON, err := marshalMeta(meta)
	if err != nil {
		return Receipt{}, err
	}

	// RESUME is the machine's "retry the automated ladder" edge (ESCALATED → SEARCHING).
	// From any other state the machine refuses, and that refusal is the answer.
	adminID := in.AdminID
	expected := rec.detail.Version
	if _, err := service.bookings.Apply(ctx, in.BookingID, booking.ActionResume, booking.TransitionInput{
		Actor:           &adminID,
		ActorRole:       identity.RoleAdmin,
		Meta:            metaJSON,
		ExpectedVersion: &expected,
	}); err != nil {
		return Receipt{}, err
	}

	receipt := Receipt{BookingID: in.BookingID, Version: int32(expected + 1)}
	if err := service.recordReceipt(ctx, in.ActionInput, operationRedispatch, keyID, receipt); err != nil {
		return Receipt{}, err
	}
	return receipt, nil
}

// ------------------------------------------------------------------ manual completion

// ManualCompletionAttestations are the three statements the operator signs.
type ManualCompletionAttestations struct {
	AttemptedCustomer bool
	BelievesWorkDone  bool
	SpokeToProvider   bool
}

// ManualCompletionEvidenceRefs is the evidence the operator submits.
type ManualCompletionEvidenceRefs struct {
	CallAttemptIDs     []string
	CompletionReportID *string
	WorkPhotoIDs       []string
}

// ManualCompleteInput asserts a completion the customer's OTP never proved.
type ManualCompleteInput struct {
	ActionInput
	ReasonCode   string
	Note         string
	Attestations ManualCompletionAttestations
	Evidence     ManualCompletionEvidenceRefs
}

// manualCompletionEventMeta is the admin-verified marker the VERIFY_COMPLETION transition
// records — it is what makes the completion read as admin-asserted everywhere downstream.
type manualCompletionEventMeta struct {
	ManualCompletion struct {
		AdminVerified bool   `json:"admin_verified"`
		ReasonCode    string `json:"reason_code"`
		Note          string `json:"note"`
		CallAttempts  int    `json:"call_attempts"`
		WorkPhotos    int    `json:"work_photos"`
	} `json:"manual_completion"`
}

// ManualComplete verifies the 30-minute lock and the evidence gates, then walks the
// EXISTING completion path: the VERIFY_COMPLETION transition (as the admin) publishes
// booking.completed, which releases payment collection exactly as a customer-OTP
// completion does.
func (service *Service) ManualComplete(ctx context.Context, in ManualCompleteInput) (Receipt, error) {
	var replayed Receipt
	keyID, found, err := service.replayInto(ctx, operationManualComplete, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return Receipt{}, err
	}
	if found {
		return replayed, nil
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return Receipt{}, err
	}
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return Receipt{}, err
	}
	if rec.detail.State == booking.StateCompleted {
		return Receipt{}, &TerminalStateError{State: rec.detail.State.String()}
	}
	if rec.detail.State != booking.StateAwaitingCompletion {
		return Receipt{}, &NotEligibleError{Reason: "manual completion needs a booking awaiting its completion OTP"}
	}

	workReportedAt := lastActionAt(rec.detail.Timeline, booking.ActionRequestCompletion)
	if workReportedAt == nil {
		return Receipt{}, &NotEligibleError{Reason: "no completion has been reported for this booking"}
	}
	if availableAt := workReportedAt.Add(ManualCompletionLock); time.Now().Before(availableAt) {
		return Receipt{}, &TooEarlyError{AvailableAt: availableAt}
	}

	missing := make([]string, 0, 4)
	if len(in.Evidence.CallAttemptIDs) == 0 {
		missing = append(missing, "callAttempts")
	}
	if !in.Attestations.AttemptedCustomer {
		missing = append(missing, "attestations.attemptedCustomer")
	}
	if !in.Attestations.BelievesWorkDone {
		missing = append(missing, "attestations.believesWorkDone")
	}
	if !in.Attestations.SpokeToProvider {
		missing = append(missing, "attestations.spokeToProvider")
	}
	if len(missing) > 0 {
		return Receipt{}, &EvidenceError{Missing: missing}
	}
	if len(in.Note) < manualCompletionNoteMinLength {
		return Receipt{}, &ValidationError{Field: "note", Message: "at least 20 characters"}
	}

	var meta manualCompletionEventMeta
	meta.ManualCompletion.AdminVerified = true
	meta.ManualCompletion.ReasonCode = in.ReasonCode
	meta.ManualCompletion.Note = in.Note
	meta.ManualCompletion.CallAttempts = len(in.Evidence.CallAttemptIDs)
	meta.ManualCompletion.WorkPhotos = len(in.Evidence.WorkPhotoIDs)
	metaJSON, err := marshalMeta(meta)
	if err != nil {
		return Receipt{}, err
	}

	// UPI is the honest payment method for an admin-asserted completion: the customer still
	// owes payment, so the completion path opens the booking-specific collection. CASH would
	// assert custody money the technician never reported holding.
	adminID := in.AdminID
	expected := rec.detail.Version
	if _, err := service.bookings.Apply(ctx, in.BookingID, booking.ActionVerifyCompletion, booking.TransitionInput{
		Actor:           &adminID,
		ActorRole:       identity.RoleAdmin,
		PaymentMethod:   ledger.PaymentUPI.String(),
		Meta:            metaJSON,
		ExpectedVersion: &expected,
	}); err != nil {
		return Receipt{}, err
	}

	receipt := Receipt{BookingID: in.BookingID, Version: int32(expected + 1)}
	if err := service.recordReceipt(ctx, in.ActionInput, operationManualComplete, keyID, receipt); err != nil {
		return Receipt{}, err
	}
	return receipt, nil
}

// ---------------------------------------------------------------------------- refund

// RefundInput refunds or credits a booking.
type RefundInput struct {
	ActionInput
	Amount       money.Money
	ReasonCode   string
	RefundType   string
	PayoutImpact string
	Note         string
}

// Refund records an admin refund as an immediate ledger credit. There is deliberately NO
// undo: money movement is corrected by a compensating, itself-audited entry. The replay
// record is written in the SAME transaction as the credit, so a retried refund can never
// move money twice.
func (service *Service) Refund(ctx context.Context, in RefundInput) (RefundReceipt, error) {
	var replayed RefundReceipt
	keyID, found, err := service.replayInto(ctx, operationRefund, in.BookingID, in.IdempotencyKey, &replayed)
	if err != nil {
		return RefundReceipt{}, err
	}
	if found {
		return replayed, nil
	}

	rec, err := service.loadRecord(ctx, in.BookingID)
	if err != nil {
		return RefundReceipt{}, err
	}
	if err := requireVersion(rec.detail, in.Version); err != nil {
		return RefundReceipt{}, err
	}
	if in.Amount.Paise() <= 0 {
		return RefundReceipt{}, &ValidationError{Field: "amountPaise", Message: "a refund must be a positive amount"}
	}
	refundable, _, err := service.refundableFor(ctx, rec)
	if err != nil {
		return RefundReceipt{}, err
	}
	switch in.RefundType {
	case "goodwill_credit":
		if in.Amount.Paise() > GoodwillCapPaise {
			return RefundReceipt{}, &CapExceededError{Cap: money.FromPaise(GoodwillCapPaise), Field: "amountPaise"}
		}
	case "full", "partial":
		if in.Amount.Paise() > refundable.Paise() {
			return RefundReceipt{}, &ValidationError{Field: "amountPaise", Message: "exceeds the refundable amount"}
		}
	default: // wallet_credit, waive_fee — bounded by the booking's value
		if in.Amount.Paise() > rec.detail.Amount.Paise() {
			return RefundReceipt{}, &ValidationError{Field: "amountPaise", Message: "exceeds the booking value"}
		}
	}

	used, oldest, err := service.trail.CountAdminActionsSince(ctx, in.AdminID, refundAuditAction, time.Now().Add(-time.Hour))
	if err != nil {
		return RefundReceipt{}, err
	}
	if used >= RefundsAllowedPerHour {
		resetsAt := time.Now().Add(time.Hour)
		if oldest != nil {
			resetsAt = oldest.Add(time.Hour)
		}
		return RefundReceipt{}, &RateLimitedError{ResetAt: resetsAt}
	}

	receipt := RefundReceipt{
		Receipt: Receipt{BookingID: in.BookingID, Version: int32(rec.detail.Version)},
		// The credit id is minted here so the receipt — stored atomically with the credit —
		// can name it.
		RefundID:  uuid.New(),
		IsPending: false,
	}
	replayKeyID := keyID
	if _, err := service.ledger.RecordAdminCredit(ctx, ledger.AdminCreditInput{
		CreditID:    receipt.RefundID,
		BookingID:   in.BookingID,
		AdminID:     in.AdminID,
		Amount:      in.Amount,
		Memo:        fmt.Sprintf("admin refund — %s (%s)", in.ReasonCode, in.RefundType),
		AuditAction: refundAuditAction,
		AuditDetail: map[string]string{
			"reason_code":   in.ReasonCode,
			"refund_type":   in.RefundType,
			"payout_impact": in.PayoutImpact,
			"note":          in.Note,
		},
		ReplayKeyID:   &replayKeyID,
		ReplayReceipt: receipt,
	}); err != nil {
		return RefundReceipt{}, err
	}
	return receipt, nil
}
