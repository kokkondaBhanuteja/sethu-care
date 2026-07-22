import { CircleCheck, CircleSlash, Clock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Pill, type PillTone } from "../../components/ui/Pill";
import { formatMoney } from "../../lib/format";
import { PAYOUT_STATUSES } from "./settings.constants";
import type { PayoutRow, PayoutStatus } from "./settings.types";

const STATUS_TONES: Readonly<Record<PayoutStatus, PillTone>> = {
  [PAYOUT_STATUSES.ready]: "success",
  [PAYOUT_STATUSES.onHold]: "warning",
  [PAYOUT_STATUSES.blocked]: "danger",
};

const STATUS_ICONS = {
  [PAYOUT_STATUSES.ready]: CircleCheck,
  [PAYOUT_STATUSES.onHold]: Clock,
  [PAYOUT_STATUSES.blocked]: CircleSlash,
} as const;

export interface PayoutsTableProps {
  rows: readonly PayoutRow[];
}

/**
 * BOX 66. Every currency cell is right-aligned tabular monospace so ₹58,400 and ₹7,020 stack on
 * their commas — the only way a hold or a deduction is visible without reading each row.
 *
 * Amounts are paise from the server and are never touched by float arithmetic here; a negative
 * adjustment carries the danger ink because it is money leaving a provider's settlement.
 */
export function PayoutsTable({ rows }: PayoutsTableProps) {
  const { t } = useTranslation("adminSettings");

  const columns: readonly DataTableColumn<PayoutRow>[] = [
    {
      id: "provider",
      header: t("payouts.columnProvider"),
      render: (row) => (
        <span className="flex items-center gap-s3">
          <Avatar name={row.providerName} size="sm" />
          {row.providerName}
        </span>
      ),
    },
    { id: "jobs", header: t("payouts.columnJobs"), numeric: true, render: (row) => row.jobs },
    {
      id: "gross",
      header: t("payouts.columnGross"),
      numeric: true,
      render: (row) => formatMoney(row.grossPaise),
    },
    {
      id: "commission",
      header: t("payouts.columnCommission"),
      numeric: true,
      render: (row) => formatMoney(row.commissionPaise),
    },
    {
      id: "adjustments",
      header: t("payouts.columnAdjustments"),
      numeric: true,
      render: (row) => (
        <span className={row.adjustmentsPaise < 0 ? "text-danger" : undefined}>
          {formatMoney(row.adjustmentsPaise)}
        </span>
      ),
    },
    {
      id: "net",
      header: t("payouts.columnNet"),
      numeric: true,
      render: (row) => formatMoney(row.netPaise),
    },
    {
      id: "status",
      header: t("payouts.columnStatus"),
      render: (row) => (
        <Pill tone={STATUS_TONES[row.status]} icon={STATUS_ICONS[row.status]}>
          {t(`payouts.status${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}`)}
        </Pill>
      ),
    },
  ];

  return (
    <DataTable
      caption={t("payouts.tableCaption")}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.providerId}
    />
  );
}
