// Package verification owns the dual-OTP scheme and the photographic evidence of work.
package verification

import "fmt"

// Purpose is what an OTP challenge is FOR, and it is a security control, not bookkeeping.
//
// The original schema had otp_challenges with only (phone, code_hash, expires_at) — NO
// column distinguishing a Start OTP from a Completion OTP. Dual-OTP is a headline feature
// of this product: the Start OTP proves the technician actually reached the customer, and
// the Completion OTP proves the work was genuinely finished BEFORE payment.
//
// Without this distinction those two are the same object. A technician could take the code
// the customer read out on arrival and immediately replay it to mark the job complete —
// collecting payment for work never done, with the system's own verification vouching for
// it. The feature would have been decorative.
type Purpose string

const (
	// PurposeLogin authenticates a person. Never bound to a booking.
	PurposeLogin Purpose = "LOGIN"

	// PurposeStart confirms the technician physically reached the customer.
	PurposeStart Purpose = "START"

	// PurposeCompletion confirms the work is genuinely done, before any money moves.
	PurposeCompletion Purpose = "COMPLETION"
)

func AllPurposes() []Purpose {
	return []Purpose{PurposeLogin, PurposeStart, PurposeCompletion}
}

func (purpose Purpose) Valid() bool {
	switch purpose {
	case PurposeLogin, PurposeStart, PurposeCompletion:
		return true
	}
	return false
}

// RequiresBooking reports whether this purpose is meaningless without a job attached. The
// database enforces the same rule (otp_challenges_purpose_matches_booking): a job OTP with
// no job is exactly the ambiguity that lets a START challenge be replayed as a COMPLETION.
func (purpose Purpose) RequiresBooking() bool {
	switch purpose {
	case PurposeStart, PurposeCompletion:
		return true
	case PurposeLogin:
		return false
	}
	return false
}

func (purpose Purpose) String() string { return string(purpose) }

func ParsePurpose(raw string) (Purpose, error) {
	purpose := Purpose(raw)
	if !purpose.Valid() {
		return "", fmt.Errorf("verification: unknown otp purpose %q", raw)
	}
	return purpose, nil
}
