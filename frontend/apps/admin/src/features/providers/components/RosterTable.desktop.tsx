import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { cx } from "../../../lib/cx";
import { formatMoney, formatPercent, formatRelative } from "../../../lib/format";
import { ROUTES } from "../../../routes/routes.constants";
import { completionBand } from "../providers.constants";
import { METRIC_BANDS, PROVIDER_STATUSES, type ProviderRosterRow } from "../providers.types";
import { ProviderStatusIndicator } from "./ProviderStatusIndicator";
import { RatingValue } from "./Rating";

const BAND_TEXT = {
  [METRIC_BANDS.good]: "text-success",
  [METRIC_BANDS.watch]: "text-warning",
  [METRIC_BANDS.poor]: "text-danger",
} as const;

export interface RosterTableProps {
  rows: readonly ProviderRosterRow[];
}

/**
 * The desktop roster. An ops manager scans the STATUS and COMPLETION columns down the page to find
 * who can take a job and who should not be given one — which stacked cards make impossible, and
 * which is the whole argument for the wider canvas (spec §2.1).
 *
 * COMPLETION is the only coloured number in the table: it is the figure that decides whether a
 * provider gets more work, so it carries its own verdict rather than being compared to a
 * remembered threshold.
 */
export function RosterTable({ rows }: RosterTableProps) {
  const { t } = useTranslation("adminProviders");
  const navigate = useNavigate();

  const columns: readonly DataTableColumn<ProviderRosterRow>[] = [
    {
      id: "provider",
      header: t("roster.columnProvider"),
      render: (row) => (
        <span className={cx("flex items-center gap-s2", isDimmed(row) && "opacity-70")}>
          <Avatar name={row.name} size="sm" />
          <span className="text-emph text-text-1">{row.name}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("roster.columnStatus"),
      render: (row) => <ProviderStatusIndicator status={row.status} />,
    },
    {
      id: "skills",
      header: t("roster.columnSkills"),
      render: (row) => <span className="text-label text-text-2">{row.skills.join(", ")}</span>,
    },
    {
      id: "zone",
      header: t("roster.columnZone"),
      render: (row) => <span className="text-body text-text-2">{row.zone}</span>,
    },
    {
      id: "jobsToday",
      header: t("roster.columnJobsToday"),
      numeric: true,
      render: (row) => row.jobsToday,
    },
    {
      id: "earnings",
      header: t("roster.columnEarnings"),
      numeric: true,
      render: (row) => formatMoney(row.earningsTodayPaise),
    },
    {
      id: "rating",
      header: t("roster.columnRating"),
      render: (row) => (
        <RatingValue
          value={row.rating}
          tone={row.status === PROVIDER_STATUSES.suspended ? "neutral" : "warning"}
        />
      ),
    },
    {
      id: "completion",
      header: t("roster.columnCompletion"),
      render: (row) => (
        <span
          className={cx("text-emph tabular-nums", BAND_TEXT[completionBand(row.completionRate)])}
        >
          {formatPercent(row.completionRate)}
        </span>
      ),
    },
    {
      id: "lastSeen",
      header: t("roster.columnLastSeen"),
      render: (row) => (
        <span className="text-label text-text-2">
          {row.lastSeenAt === null ? t("roster.lastSeenNow") : formatRelative(row.lastSeenAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption={t("roster.tableCaption")}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      density="roomy"
      onRowClick={(row) => void navigate(ROUTES.providerDetail(row.id))}
    />
  );
}

/** Offline is temporary and the provider is otherwise in good standing, so the row is faded. */
function isDimmed(row: ProviderRosterRow): boolean {
  return row.status === PROVIDER_STATUSES.offline;
}
