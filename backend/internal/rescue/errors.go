package rescue

// The designed failures the console renders a dedicated state for. Each is a typed error so
// the transport layer can build the declared error body; classify() maps the status.

import (
	"fmt"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// StaleVersionError is the optimistic-concurrency failure: the submitted version is not the
// record's current one (409, VERSION_CONFLICT).
type StaleVersionError struct {
	CurrentVersion int32
}

func (stale *StaleVersionError) Error() string {
	return fmt.Sprintf("rescue: the record moved since it was read (current version %d)", stale.CurrentVersion)
}

// UndoWindowClosedError means the compensating action arrived after its risk-register
// window (409).
type UndoWindowClosedError struct {
	Undoes   string
	ClosedAt time.Time
}

func (closed *UndoWindowClosedError) Error() string {
	return fmt.Sprintf("rescue: the %s undo window closed at %s", closed.Undoes, closed.ClosedAt.Format(time.RFC3339))
}

// NotUndoableError means there is nothing for the compensating action to compensate — the
// booking is not in the state the undo reverses (409).
type NotUndoableError struct {
	Undoes string
	Reason string
}

func (notUndoable *NotUndoableError) Error() string {
	return fmt.Sprintf("rescue: cannot undo %s: %s", notUndoable.Undoes, notUndoable.Reason)
}

// TerminalStateError means the action cannot apply because the booking already finished
// (409 — "the booking is already terminal").
type TerminalStateError struct {
	State string
}

func (terminal *TerminalStateError) Error() string {
	return fmt.Sprintf("rescue: the booking is already %s", terminal.State)
}

// NotEligibleError means the action's preconditions do not hold from the booking's current
// position (422) — e.g. a manual completion for a booking whose work was never reported.
type NotEligibleError struct {
	Reason string
}

func (notEligible *NotEligibleError) Error() string {
	return "rescue: " + notEligible.Reason
}

// TooEarlyError is the manual completion's server-enforced 30-minute lock (409, TOO_EARLY).
type TooEarlyError struct {
	AvailableAt time.Time
}

func (early *TooEarlyError) Error() string {
	return fmt.Sprintf("rescue: the 30-minute lock still holds until %s", early.AvailableAt.Format(time.RFC3339))
}

// EvidenceError names the evidence a manual completion still owes (422,
// EVIDENCE_INSUFFICIENT).
type EvidenceError struct {
	Missing []string
}

func (evidence *EvidenceError) Error() string {
	return fmt.Sprintf("rescue: evidence insufficient — missing %v", evidence.Missing)
}

// CapExceededError means an amount exceeded its server-stated cap (422, EXCEEDS_CAP) —
// the goodwill refund cap, or the redispatch incentive cap.
type CapExceededError struct {
	Cap   money.Money
	Field string
}

func (cap *CapExceededError) Error() string {
	return fmt.Sprintf("rescue: %s exceeds the %s cap", cap.Field, cap.Cap)
}

// RateLimitedError means this admin spent their refund budget for the hour (429).
type RateLimitedError struct {
	ResetAt time.Time
}

func (limited *RateLimitedError) Error() string {
	return fmt.Sprintf("rescue: refund rate limit reached; resets at %s", limited.ResetAt.Format(time.RFC3339))
}

// ValidationError is a request that is well-formed but wrong (422), with the field the
// console should point at.
type ValidationError struct {
	Field   string
	Message string
}

func (invalid *ValidationError) Error() string {
	return fmt.Sprintf("rescue: %s: %s", invalid.Field, invalid.Message)
}
