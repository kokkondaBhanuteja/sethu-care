// Money formatting — mirrors the backend's Money value object, which is always paise (int64).
// The app never does float arithmetic on money; it receives paise, formats for display, and sends
// rupee strings back (as the backend's money.FromRupees expects). Formatting uses Intl `en-IN`, so
// amounts group in the Indian lakh/crore style with the ₹ symbol (Hermes ships full Intl).

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an amount in paise as a display string, e.g. 12500000 -> "₹1,25,000.00". */
export function formatPaise(paise: number): string {
  return inrFormatter.format(paise / 100);
}

/** Rupees as a number (for calculations that must not touch paise directly). */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** A rupee string the backend's money.FromRupees accepts, e.g. 59900 -> "599.00". */
export function paiseToRupeeString(paise: number): string {
  return (paise / 100).toFixed(2);
}
