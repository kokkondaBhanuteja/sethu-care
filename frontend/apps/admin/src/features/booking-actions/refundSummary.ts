import { formatMoney } from "../../lib/format";
import { REFUND_PAYOUT_IMPACTS } from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { RefundContext } from "./booking-actions.types";
import type { RefundValues } from "./useRefund";

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * The four facts that cannot be undone — amount, destination, reason, withheld payout — restated
 * for the step-up. Nothing on the confirm surface is editable; the only way to change a value is to
 * back out.
 */
export function refundSummaryLine(
  context: RefundContext | null,
  values: RefundValues,
  translate: Translate,
): string {
  if (!context) return "";

  const withheld = values.payoutImpact === REFUND_PAYOUT_IMPACTS.withhold;

  return translate("refund.confirmSummary", {
    amount: formatMoney(rupeesToPaise(values.amountRupees)),
    method: context.originalMethodLabel,
    customer: context.booking.customerName,
    reason: values.reasonCode ? translate(`refund.reason.${values.reasonCode}`) : "",
    payout: withheld
      ? translate("refund.confirmPayoutWithheld", {
          amount: formatMoney(context.providerPayoutPaise),
        })
      : translate("refund.confirmPayoutPaid"),
  });
}

/** The exact message the customer will read. An operator should never have to guess at it. */
export function refundCustomerMessage(
  context: RefundContext | null,
  values: RefundValues,
  translate: Translate,
): string {
  if (!context) return "";

  return translate("refund.customerMessage", {
    amount: formatMoney(rupeesToPaise(values.amountRupees)),
    reference: context.booking.reference,
  });
}
