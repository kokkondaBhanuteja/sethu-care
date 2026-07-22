import { formatMoney } from "../../lib/format";
import { rupeesToPaise } from "./booking-actions.money";
import type { CancelContext } from "./booking-actions.types";
import type { CancelValues } from "./useCancelBooking";

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * The four facts the step-up restates: booking, service, refund, reason. A verification prompt
 * arrives after the eyes have already left the form, so this is the last chance to catch a wrong
 * row — which is why it is composed from the submitted values, not from the screen.
 */
export function cancelSummaryLine(
  context: CancelContext | null,
  values: CancelValues,
  translate: Translate,
): string {
  if (!context) return "";

  const refundPaise = values.useCustomRefund
    ? rupeesToPaise(values.customAmountRupees)
    : context.policyRefundPaise;

  return translate("cancel.confirmSummary", {
    reference: context.booking.reference,
    service: context.booking.serviceName,
    amount: formatMoney(refundPaise),
    reason: values.reasonCode ? translate(`cancel.reason.${values.reasonCode}`) : "",
  });
}
