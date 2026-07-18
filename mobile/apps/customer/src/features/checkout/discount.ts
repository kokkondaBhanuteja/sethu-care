// Checkout discounts (client-side, mirrors the Offers page + SETHU+ membership). Promo codes and the
// membership discount aren't validated by a backend yet, so the rules live here; when a coupon API
// lands, swap computeCheckout for a server call — the return shape stays the same.

type PromoRule = { kind: "percent" | "flat"; value: number; label: string };

// value: percent (0-100) or flat paise. Matches the codes shown on the Offers tab.
const PROMO_CODES: Record<string, PromoRule> = {
  SUMMER20: { kind: "percent", value: 20, label: "20% off" },
  WELCOME: { kind: "flat", value: 10000, label: "₹100 off" },
  REFER10: { kind: "flat", value: 15000, label: "₹150 off" },
};

// SETHU+ members save 15% when no promo code beats it.
const MEMBER_PERCENT = 15;

export interface CheckoutTotals {
  basePaise: number;
  discountPaise: number;
  finalPaise: number;
  /** Human label for the applied discount, or null when none. */
  appliedLabel: string | null;
  /** True when a code was entered but isn't recognised. */
  invalidCode: boolean;
}

function percentOff(basePaise: number, percent: number): number {
  return Math.round((basePaise * percent) / 100);
}

// Resolve the best available discount: a valid promo code takes precedence, otherwise the SETHU+
// member rate. Never discounts below zero.
export function computeCheckout(
  basePaise: number,
  { promoCode, isMember }: { promoCode?: string; isMember?: boolean },
): CheckoutTotals {
  const code = promoCode?.trim().toUpperCase() ?? "";
  const rule = code ? PROMO_CODES[code] : undefined;
  const invalidCode = code.length > 0 && !rule;

  let discountPaise = 0;
  let appliedLabel: string | null = null;

  if (rule) {
    discountPaise = rule.kind === "percent" ? percentOff(basePaise, rule.value) : rule.value;
    appliedLabel = `${code} · ${rule.label}`;
  } else if (isMember) {
    discountPaise = percentOff(basePaise, MEMBER_PERCENT);
    appliedLabel = `SETHU+ · ${MEMBER_PERCENT}% off`;
  }

  discountPaise = Math.min(discountPaise, basePaise);
  return {
    basePaise,
    discountPaise,
    finalPaise: basePaise - discountPaise,
    appliedLabel,
    invalidCode,
  };
}
