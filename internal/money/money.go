// Package money represents every rupee in this system.
//
// GO LESSON — `type Money int64` is a DEFINED TYPE, not an alias.
//
// In Java we needed @Embeddable, a wrapper record, an @AttributeOverride per column,
// and a Jackson serializer to get type-safe money. Go gives it in one line. Money and
// int64 are DIFFERENT types: you cannot pass an int64 where a Money is wanted, and if
// we later declare `type Metres int64`, Money + Metres will not compile either.
//
// (An *alias*, `type Money = int64`, would be the opposite — the same type under a new
// name, with no safety at all. The `=` is the whole difference. This is a classic Go
// trap and it is worth staring at once.)
//
// Because Money's underlying type is int64, encoding/json already marshals it as a
// plain number, and pgx already reads it from a BIGINT. We inherit the machinery for
// free while keeping the safety. That is the payoff of a defined type.
package money

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Money is an amount in PAISE. Never rupees, never a float.
//
// The bug this exists to kill: money crosses three boundaries here in two different
// units — Postgres stores paise, the apps display rupees, Razorpay takes paise. As a
// bare int64, FromRupees(599) and FromPaise(599) are indistinguishable, and one of them
// charges ₹5.99 instead of ₹599. Now they are two different, explicit calls.
//
// What this does NOT do: stop you charging the wrong amount. Bad pricing logic will be
// wrong in beautifully type-safe rupees. This prevents REPRESENTATION errors — wrong
// unit, wrong rounding, wrong sign — not LOGIC errors.
type Money int64

// Zero is the amount a warranty job resolves to (ROADMAP §6): no payment step at all.
const Zero Money = 0

// GO LESSON — errors are VALUES, declared up front, not thrown.
//
// Callers compare with errors.Is(err, money.ErrSubPaise) rather than catching a type.
// Every error we return below is WRAPPED with %w, which is what makes errors.Is work
// through the layers above.
var (
	ErrInvalidAmount = errors.New("money: not a valid amount")
	ErrSubPaise      = errors.New("money: sub-paise precision is not representable")
	ErrNegative      = errors.New("money: amount must not be negative")
	ErrOverflow      = errors.New("money: arithmetic overflow")
)

// FromPaise builds an amount from paise, as Postgres and Razorpay speak it.
func FromPaise(paise int64) Money { return Money(paise) }

// FromRupees parses rupees as a human writes them: "599", "499.99", "-250".
//
// Deliberately NOT float64. 499.99 has no exact binary representation, so a float path
// would drift by a paisa somewhere — in an append-only ledger, where the row can never
// be edited, only offset by a correcting entry.
func FromRupees(s string) (Money, error) {
	t := strings.TrimSpace(s)
	if t == "" {
		return 0, fmt.Errorf("%w: empty string", ErrInvalidAmount)
	}

	negative := false
	switch t[0] {
	case '-':
		negative, t = true, t[1:]
	case '+':
		t = t[1:]
	}

	whole, frac, _ := strings.Cut(t, ".")
	if whole == "" && frac == "" {
		return 0, fmt.Errorf("%w: %q", ErrInvalidAmount, s)
	}
	// "1.005" is a real amount that we cannot store. Refuse it loudly rather than
	// rounding silently — a silent half-paisa is exactly how ledgers stop reconciling.
	if len(frac) > 2 {
		return 0, fmt.Errorf("%w: %q", ErrSubPaise, s)
	}
	if whole == "" {
		whole = "0"
	}
	for len(frac) < 2 { // "5" means 50 paise, not 5
		frac += "0"
	}
	if !allDigits(whole) || !allDigits(frac) {
		return 0, fmt.Errorf("%w: %q", ErrInvalidAmount, s)
	}

	// GO LESSON — fmt.Errorf accepts MULTIPLE %w verbs (Go 1.20+). Both errors stay in
	// the chain, so errors.Is(err, money.ErrOverflow) AND errors.Is(err, strconv.ErrRange)
	// both work on the same value. Using %v here instead would format the underlying
	// error into the text and then DROP it from the chain — which is exactly what the
	// errorlint linter just caught.
	rupees, err := strconv.ParseInt(whole, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q: %w", ErrOverflow, s, err)
	}
	fracPaise, err := strconv.ParseInt(frac, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q: %w", ErrInvalidAmount, s, err)
	}

	total := rupees * 100
	if rupees != 0 && total/100 != rupees { // multiplication wrapped around
		return 0, fmt.Errorf("%w: %q", ErrOverflow, s)
	}
	if total > math.MaxInt64-fracPaise {
		return 0, fmt.Errorf("%w: %q", ErrOverflow, s)
	}
	total += fracPaise

	if negative {
		total = -total
	}
	return Money(total), nil
}

// MustFromRupees is for constants and tests, where a bad literal is a bug, not an input.
//
// GO LESSON — the "Must" prefix is a Go convention meaning "panics instead of returning
// an error". Reserve it for values you control. NEVER call it on user input.
func MustFromRupees(s string) Money {
	m, err := FromRupees(s)
	if err != nil {
		panic(err)
	}
	return m
}

// Paise returns the raw amount, for the database and for Razorpay.
func (amount Money) Paise() int64 { return int64(amount) }

// GO LESSON — value receivers, not pointer receivers.
//
// `func (m Money) Add(...)` copies an 8-byte int. That is free, and it makes Money
// immutable: Add cannot modify the receiver even by accident. A pointer receiver
// (`func (m *Money) Add`) would let a method mutate money in place, which is exactly
// what we do not want. Small immutable values take value receivers.

// Add returns m + other. Panics on overflow rather than wrapping around into a negative.
//
// A panic is a crash; a wrapped int64 is a corrupt ledger row that can never be edited.
// The crash is strictly better. (In practice this is unreachable: int64 paise tops out
// around ₹92 quadrillion.)
func (amount Money) Add(other Money) Money {
	sum := amount + other
	if (sum > amount) != (other > 0) && other != 0 {
		panic(fmt.Errorf("%w: %d + %d", ErrOverflow, amount, other))
	}
	return sum
}

// Sub returns m - other. May be negative: that is how the ledger corrects itself.
func (amount Money) Sub(other Money) Money {
	diff := amount - other
	if (diff < amount) != (other > 0) && other != 0 {
		panic(fmt.Errorf("%w: %d - %d", ErrOverflow, amount, other))
	}
	return diff
}

// Mul scales by a quantity — a booking line of 3 units, say.
func (amount Money) Mul(quantity int) Money {
	if amount == 0 || quantity == 0 {
		return Zero
	}
	product := amount * Money(quantity)
	if product/Money(quantity) != amount {
		panic(fmt.Errorf("%w: %d × %d", ErrOverflow, amount, quantity))
	}
	return product
}

// IsZero reports whether payment should be skipped entirely — a warranty job (ROADMAP §6).
func (amount Money) IsZero() bool { return amount == 0 }

// IsNegative reports a credit or a correcting entry.
func (amount Money) IsNegative() bool { return amount < 0 }

// RequireNonNegative guards the columns where a negative amount is nonsense: a quoted
// total, a base price.
//
// Deliberately NOT enforced in the constructor. ledger_entries corrects mistakes with
// negative offsetting rows, and that is by design (ROADMAP §6 — the ledger is
// append-only; you never mutate a row, you offset it). So negative Money must be
// constructible, and it is the specific callers who opt in to the guard.
func (amount Money) RequireNonNegative() error {
	if amount.IsNegative() {
		return fmt.Errorf("%w: %s", ErrNegative, amount)
	}
	return nil
}

// Rupees renders the bare number for APIs and CSVs: "499.99".
func (amount Money) Rupees() string {
	sign, n := "", int64(amount)
	if n < 0 {
		sign, n = "-", -n
	}
	return fmt.Sprintf("%s%d.%02d", sign, n/100, n%100)
}

// String renders for humans, logs, and admin screens: "₹499.99".
//
// GO LESSON — declaring String() makes Money satisfy fmt.Stringer implicitly. There is
// no `implements` keyword: if the method set matches, the type satisfies the interface.
// fmt.Printf("%v", someMoney) now prints ₹499.99 with no further wiring.
func (amount Money) String() string { return "₹" + amount.Rupees() }

func allDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}
