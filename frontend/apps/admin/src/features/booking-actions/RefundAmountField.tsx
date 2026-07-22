import { useTranslation } from "@sethu/i18n";

import { TextInput } from "../../components/ui/form/TextInput";
import { formatMoney } from "../../lib/format";
import type { RefundContext } from "./booking-actions.types";
import type { RefundLimits } from "./refundLimits";

export interface RefundAmountFieldProps {
  context: RefundContext;
  limits: RefundLimits;
  amountRupees: number;
  onAmountChange: (value: number) => void;
}

/**
 * The error is attached to the field that caused it rather than raised as a banner, and it names
 * both the limit and the way past it — "needs Super Admin approval" is a route, not a wall. Stating
 * only "exceeds the cap" would strand an operator with a customer on the line.
 */
export function RefundAmountField({
  context,
  limits,
  amountRupees,
  onAmountChange,
}: RefundAmountFieldProps) {
  const { t } = useTranslation("adminBookingActions");

  const capMessage = limits.exceedsGoodwillCap
    ? t("refund.capExceeded", { cap: formatMoney(context.goodwillCapPaise) })
    : limits.exceedsRefundable
      ? t("refund.aboveRefundable", { amount: formatMoney(context.refundablePaise) })
      : null;

  return (
    <div className="flex flex-col gap-s2">
      <TextInput
        label={t("refund.amountLabel")}
        type="number"
        min={0}
        inputMode="decimal"
        required
        value={amountRupees}
        onChange={(event) => onAmountChange(Number(event.target.value))}
        {...(capMessage ? { error: capMessage } : {})}
      />

      {/* sr-only, not a second visible copy: the field's own error is the one visual instance,
          and this live region keeps the announcement for screen readers when the cap trips. */}
      {capMessage ? (
        <p role="status" className="sr-only">
          {capMessage}
        </p>
      ) : null}

      <p className="text-caption text-text-3">
        {t("refund.amountBreakdown", {
          value: formatMoney(context.bookingValuePaise),
          refunded: formatMoney(context.alreadyRefundedPaise),
          refundable: formatMoney(context.refundablePaise),
        })}
      </p>
    </div>
  );
}
