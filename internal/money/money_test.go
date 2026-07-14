package money_test // GO LESSON: the _test suffix means we can only touch the exported
// API — the same view a caller has. It keeps tests honest about the public surface.

import (
	"errors"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// GO LESSON — TABLE-DRIVEN TESTS. This is THE Go testing idiom: cases as data, one loop.
// t.Run gives each case its own name in the output, and t.Parallel runs them concurrently.
// You will write this shape a hundred times.
func TestFromRupees(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		input string
		want  int64
	}{
		{"whole rupees", "500", 50_000},
		{"with paise", "499.99", 49_999},
		{"zero", "0", 0},
		{"single decimal means tens of paise", "5.5", 550},
		{"negative, for ledger corrections", "-250", -25_000},
		{"leading plus", "+99", 9_900},
		{"surrounding space", "  1250.75  ", 125_075},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := money.FromRupees(tc.input)
			if err != nil {
				t.Fatalf("FromRupees(%q) returned unexpected error: %v", tc.input, err)
			}
			if got.Paise() != tc.want {
				t.Errorf("FromRupees(%q) = %d paise, want %d", tc.input, got.Paise(), tc.want)
			}
		})
	}
}

func TestFromRupeesRejectsBadInput(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		input   string
		wantErr error
	}{
		{"sub-paise is refused, not rounded", "1.005", money.ErrSubPaise},
		{"three decimals", "10.123", money.ErrSubPaise},
		{"empty", "", money.ErrInvalidAmount},
		{"letters", "abc", money.ErrInvalidAmount},
		{"bare dot", ".", money.ErrInvalidAmount},
		{"currency symbol is not our job", "₹500", money.ErrInvalidAmount},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := money.FromRupees(tc.input)
			// GO LESSON: errors.Is unwraps the %w chain, so this matches even though the
			// returned error is a wrapped fmt.Errorf carrying extra context.
			if !errors.Is(err, tc.wantErr) {
				t.Errorf("FromRupees(%q) error = %v, want %v", tc.input, err, tc.wantErr)
			}
		})
	}
}

// The entire reason this type exists.
func TestRupeesAndPaiseAreNotConfusable(t *testing.T) {
	t.Parallel()

	if got := money.MustFromRupees("599"); got != money.FromPaise(59_900) {
		t.Errorf("FromRupees(599) = %d, want 59900 paise", got.Paise())
	}
	// The bug we are preventing: ₹599 is NOT 599 paise. It is 100× more.
	if money.MustFromRupees("599") == money.FromPaise(599) {
		t.Error("₹599 must not equal 599 paise — the whole type is pointless if it does")
	}
}

func TestArithmetic(t *testing.T) {
	t.Parallel()

	base := money.MustFromRupees("500")
	addOn := money.MustFromRupees("99.50")

	if got, want := base.Add(addOn), money.MustFromRupees("599.50"); got != want {
		t.Errorf("Add = %s, want %s", got, want)
	}
	if got, want := base.Sub(addOn), money.MustFromRupees("400.50"); got != want {
		t.Errorf("Sub = %s, want %s", got, want)
	}
	if got, want := base.Mul(3), money.MustFromRupees("1500"); got != want {
		t.Errorf("Mul = %s, want %s", got, want)
	}
}

// GO LESSON — testing a panic. defer+recover is how you assert one.
func TestOverflowPanicsRatherThanWrappingIntoNegativeMoney(t *testing.T) {
	t.Parallel()

	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("expected a panic on overflow; got none — money silently wrapped around")
		}
		if err, ok := r.(error); !ok || !errors.Is(err, money.ErrOverflow) {
			t.Errorf("panicked with %v, want ErrOverflow", r)
		}
	}()

	money.FromPaise(1<<63 - 1).Add(money.FromPaise(1))
}

// ROADMAP §6: a warranty job resolves to zero and skips the payment step entirely.
func TestIsZeroSoWarrantyJobsCanSkipPayment(t *testing.T) {
	t.Parallel()

	if !money.Zero.IsZero() {
		t.Error("Zero.IsZero() = false")
	}
	if !money.MustFromRupees("0").IsZero() {
		t.Error(`MustFromRupees("0").IsZero() = false`)
	}
	if money.MustFromRupees("0.01").IsZero() {
		t.Error("one paisa must not be zero")
	}
}

// The ledger MUST be able to hold a negative (that is how it corrects itself), while the
// columns where negative is nonsense opt in to the guard.
func TestNegativeAllowedForLedgerButGuardedWhereAsked(t *testing.T) {
	t.Parallel()

	refund := money.MustFromRupees("-250")
	if !refund.IsNegative() {
		t.Fatal("expected negative")
	}
	if err := refund.RequireNonNegative(); !errors.Is(err, money.ErrNegative) {
		t.Errorf("RequireNonNegative() = %v, want ErrNegative", err)
	}
	if err := money.MustFromRupees("250").RequireNonNegative(); err != nil {
		t.Errorf("RequireNonNegative() on a positive amount = %v, want nil", err)
	}
}

func TestFormatting(t *testing.T) {
	t.Parallel()

	cases := []struct {
		paise        int64
		wantRupees   string
		wantedString string
	}{
		{49_999, "499.99", "₹499.99"},
		{0, "0.00", "₹0.00"},
		{5, "0.05", "₹0.05"},
		{-25_000, "-250.00", "₹-250.00"},
	}

	for _, tc := range cases {
		m := money.FromPaise(tc.paise)
		if got := m.Rupees(); got != tc.wantRupees {
			t.Errorf("FromPaise(%d).Rupees() = %q, want %q", tc.paise, got, tc.wantRupees)
		}
		if got := m.String(); got != tc.wantedString {
			t.Errorf("FromPaise(%d).String() = %q, want %q", tc.paise, got, tc.wantedString)
		}
	}
}
