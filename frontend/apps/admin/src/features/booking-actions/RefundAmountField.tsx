import { CircleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
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

      {capMessage ? (
        <p className="flex items-start gap-s2 text-label text-danger">
          <Icon glyph={CircleAlert} size="sm" className="text-danger" />
          <span>{capMessage}</span>
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
