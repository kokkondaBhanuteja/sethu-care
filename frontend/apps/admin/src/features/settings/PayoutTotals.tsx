import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { formatMoney } from "../../lib/format";
import type { PayoutCycle } from "./settings.types";

export interface PayoutTotalsProps {
  totals: PayoutCycle["totals"];
}

/**
 * The cycle totals from BOX 66, kept verbatim: they cover all 62 providers, not the eight rows
 * above, which is why they sit under the table rather than inside it as a summed footer.
 */
export function PayoutTotals({ totals }: PayoutTotalsProps) {
  const { t } = useTranslation("adminSettings");

  const cells = [
    { id: "jobs", label: t("payouts.columnJobs"), value: String(totals.jobs), negative: false },
    {
      id: "gross",
      label: t("payouts.columnGross"),
      value: formatMoney(totals.grossPaise),
      negative: false,
    },
    {
      id: "commission",
      label: t("payouts.columnCommission"),
      value: formatMoney(totals.commissionPaise),
      negative: false,
    },
    {
      id: "adjustments",
      label: t("payouts.columnAdjustments"),
      value: formatMoney(totals.adjustmentsPaise),
      negative: totals.adjustmentsPaise < 0,
    },
    {
      id: "net",
      label: t("payouts.columnNet"),
      value: formatMoney(totals.netPaise),
      negative: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-end gap-s5 border-t border-border-subtle px-s4 py-s3">
      <span className="text-pill uppercase tracking-wider text-text-3">{t("payouts.total")}</span>
      {cells.map((cell) => (
        <span key={cell.id} className="flex flex-col items-end">
          <span className="text-caption text-text-3">{cell.label}</span>
          <span
            className={cx(
              "font-mono text-mono tabular-nums",
              cell.negative ? "text-danger" : "text-text-1",
            )}
          >
            {cell.value}
          </span>
        </span>
      ))}
    </div>
  );
}
