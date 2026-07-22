import { REFUND_TYPES, type RefundTypeId } from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { RefundContext } from "./booking-actions.types";

export interface RefundLimits {
  /** The hourly ceiling is spent — the whole form is replaced rather than disabled field by field. */
  readonly isRateLimited: boolean;
  /** Goodwill above the cap needs Super Admin approval from desktop; it is a route, not a wall. */
  readonly exceedsGoodwillCap: boolean;
  readonly exceedsRefundable: boolean;
  readonly isBlocked: boolean;
}

/**
 * Mirrors of the two limits the SERVER enforces (spec §6.27): the goodwill cap and the 10-per-hour
 * refund rate limit. They are reproduced here so the screen can explain itself before a round trip,
 * never so the client can decide — the mock and the backend both reject anything that gets through.
 */
export function refundLimits(
  context: RefundContext | null,
  refundType: string,
  amountRupees: number,
): RefundLimits {
  if (!context) {
    return {
      isRateLimited: false,
      exceedsGoodwillCap: false,
      exceedsRefundable: false,
      isBlocked: false,
    };
  }

  const amountPaise = rupeesToPaise(amountRupees);
  const isRateLimited = context.refundsUsedThisHour >= context.refundsAllowedPerHour;
  const exceedsGoodwillCap =
    (refundType as RefundTypeId) === REFUND_TYPES.goodwillCredit &&
    amountPaise > context.goodwillCapPaise;
  const exceedsRefundable =
    (refundType as RefundTypeId) !== REFUND_TYPES.goodwillCredit &&
    amountPaise > context.refundablePaise;

  return {
    isRateLimited,
    exceedsGoodwillCap,
    exceedsRefundable,
    isBlocked: isRateLimited || exceedsGoodwillCap || exceedsRefundable,
  };
}
