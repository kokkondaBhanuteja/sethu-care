import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { formatMoney } from "../../lib/format";
import { INSTANT_REFUND_TYPES, type RefundTypeId } from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { RefundContext } from "./booking-actions.types";

export interface RefundSummaryPanelProps {
  context: RefundContext;
  refundType: RefundTypeId;
  amountRupees: number;
}

/**
 * Everything the choice PRODUCES, pinned while the form is being filled. READ-ONLY on purpose: the
 * provider-payout decision is a money choice and lives in the form column with the other choices —
 * a sidebar narrow enough to wrap a label over four lines is no place to decide someone's payout.
 */
export function RefundSummaryPanel({ context, refundType, amountRupees }: RefundSummaryPanelProps) {
  const { t } = useTranslation("adminBookingActions");
  const rows = [
    { id: "booking", label: t("refund.summaryBooking"), value: context.booking.reference },
    { id: "customer", label: t("refund.summaryCustomer"), value: context.booking.customerName },
    { id: "original", label: t("refund.summaryOriginal"), value: context.originalMethodLabel },
  ];

  return (
    <Card tone="surface">
      <p className="mb-s3 text-pill text-text-3">{t("refund.summaryTitle")}</p>

      <dl className="flex flex-col gap-s2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-s3">
            <dt className="text-label text-text-2">{row.label}</dt>
            <dd className="text-label text-text-1">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-s3">
          <dt className="text-label text-text-2">{t("refund.summaryAmount")}</dt>
          <dd className="text-section font-semibold text-text-1">
            {formatMoney(rupeesToPaise(amountRupees))}
          </dd>
        </div>
      </dl>

      <p className="mt-s1 text-caption text-text-2">
        {INSTANT_REFUND_TYPES.has(refundType)
          ? t("refund.timingInstant")
          : t("refund.timingBankingDays")}
      </p>

      <p className="mt-s3 border-t border-border-subtle pt-s3 text-caption text-text-3">
        {t("refund.rateBudget", {
          used: context.refundsUsedThisHour,
          allowed: context.refundsAllowedPerHour,
        })}
      </p>
    </Card>
  );
}
