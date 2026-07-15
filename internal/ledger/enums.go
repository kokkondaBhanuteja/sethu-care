// Package ledger owns the money (ROADMAP §6).
//
// Customers pay the COMPANY. Technicians are SALARIED. Money never flows
// company → technician per job. ledger_entries is append-only — enforced by a database
// trigger, not by convention: you never mutate a row, you write an offsetting one.
package ledger

import "fmt"

// EntryKind is what a row of money MEANS.
//
// Like QuestionKind, this existed only as a SQL string literal in the original design —
// five values in a CHECK constraint with nothing in the code bound to them.
type EntryKind string

const (
	// EntryRevenue — the customer paid us. Attaches to an ORDER: money is purchased once.
	EntryRevenue EntryKind = "REVENUE"

	// EntryCashCustody — a technician is holding OUR cash. This is a DEBT TO US, and it is
	// the entry that makes cash-in-pocket visible instead of becoming unprovable shrinkage.
	// Attaches to a BOOKING: cash is collected at a specific visit.
	EntryCashCustody EntryKind = "CASH_CUSTODY"

	// EntryCashDeposit — they handed it in. Offsets the custody.
	EntryCashDeposit EntryKind = "CASH_DEPOSIT"

	// EntryCreditIssued — we owe the customer (a refund, or an apology after a FAILED booking).
	EntryCreditIssued EntryKind = "CREDIT_ISSUED"

	EntryCreditRedeemed EntryKind = "CREDIT_REDEEMED"
)

func AllEntryKinds() []EntryKind {
	return []EntryKind{
		EntryRevenue, EntryCashCustody, EntryCashDeposit,
		EntryCreditIssued, EntryCreditRedeemed,
	}
}

func (kind EntryKind) Valid() bool {
	switch kind {
	case EntryRevenue, EntryCashCustody, EntryCashDeposit, EntryCreditIssued, EntryCreditRedeemed:
		return true
	}
	return false
}

// AttachesToOrder reports whether this kind of money belongs to a PURCHASE rather than a
// VISIT. The database enforces the same split
// (ledger_entries_money_attaches_at_the_right_level) — this method exists so the code
// cannot disagree with it.
func (kind EntryKind) AttachesToOrder() bool {
	switch kind {
	case EntryRevenue, EntryCreditIssued, EntryCreditRedeemed:
		return true
	case EntryCashCustody, EntryCashDeposit:
		return false
	}
	return false
}

// IsCash reports whether this kind can only ever be settled in physical cash. A
// CASH_CUSTODY entry paid by UPI is a contradiction: with UPI the money lands directly in
// the company account and the technician never touches it, so there is nothing to be in
// custody OF.
func (kind EntryKind) IsCash() bool {
	switch kind {
	case EntryCashCustody, EntryCashDeposit:
		return true
	case EntryRevenue, EntryCreditIssued, EntryCreditRedeemed:
		return false
	}
	return false
}

func (kind EntryKind) String() string { return string(kind) }

func ParseEntryKind(raw string) (EntryKind, error) {
	kind := EntryKind(raw)
	if !kind.Valid() {
		return "", fmt.Errorf("ledger: unknown entry kind %q", raw)
	}
	return kind, nil
}

// PaymentMethod is how the customer actually paid (ROADMAP §6).
type PaymentMethod string

const (
	// PaymentUPI is primary: the technician's app shows a booking-specific COMPANY UPI QR.
	// The money lands in the company account and the technician never touches it.
	PaymentUPI PaymentMethod = "UPI"

	// PaymentCash is the fallback, and the one that needs watching — it creates custody.
	PaymentCash PaymentMethod = "CASH"

	// PaymentOnline is a Razorpay payment link (P1) or full checkout (P3).
	PaymentOnline PaymentMethod = "ONLINE"
)

func AllPaymentMethods() []PaymentMethod {
	return []PaymentMethod{PaymentUPI, PaymentCash, PaymentOnline}
}

func (method PaymentMethod) Valid() bool {
	switch method {
	case PaymentUPI, PaymentCash, PaymentOnline:
		return true
	}
	return false
}

func (method PaymentMethod) String() string { return string(method) }

func ParsePaymentMethod(raw string) (PaymentMethod, error) {
	method := PaymentMethod(raw)
	if !method.Valid() {
		return "", fmt.Errorf("ledger: unknown payment method %q", raw)
	}
	return method, nil
}

// PaymentStatus is where a UPI collection stands. It is not the money itself — that is the
// ledger — but the state of the request we put to the customer.
type PaymentStatus string

const (
	// PaymentPending — the QR has been generated; we are waiting for the customer to pay.
	PaymentPending PaymentStatus = "PENDING"

	// PaymentCaptured — the money landed in the company account; REVENUE is booked.
	PaymentCaptured PaymentStatus = "CAPTURED"
)

func AllPaymentStatuses() []PaymentStatus {
	return []PaymentStatus{PaymentPending, PaymentCaptured}
}

func (status PaymentStatus) Valid() bool {
	switch status {
	case PaymentPending, PaymentCaptured:
		return true
	}
	return false
}

func (status PaymentStatus) String() string { return string(status) }
