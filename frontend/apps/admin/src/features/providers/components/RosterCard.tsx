import { Clock } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { Pill } from "../../../components/ui/Pill";
import { cx } from "../../../lib/cx";
import { formatDate, formatDuration, formatMoney, formatRelative } from "../../../lib/format";
import { ROUTES } from "../../../routes/routes.constants";
import { PROVIDER_STATUSES, type ProviderRosterRow } from "../providers.types";
import { AVATAR_STATUS_FOR_PROVIDER, ProviderStatusIndicator } from "./ProviderStatusIndicator";
import { RatingValue } from "./Rating";

export interface RosterCardProps {
  row: ProviderRosterRow;
  /** Age of the roster's live statuses. Shown per row only once it is misleading (M36). */
  staleAgeMs: number | null;
}

/**
 * The mobile roster row. Offline is dimmed to 70% — temporary, provider in good standing.
 * Suspended sits on the recessed fill instead, because a standing decision has to stay legible:
 * fading it would hide the reason the provider cannot be dispatched.
 */
export function RosterCard({ row, staleAgeMs }: RosterCardProps) {
  const { t } = useTranslation("adminProviders");
  const isSuspended = row.status === PROVIDER_STATUSES.suspended;
  const isOffline = row.status === PROVIDER_STATUSES.offline;

  return (
    <Link
      to={ROUTES.providerDetail(row.id)}
      className={cx(
        "flex min-h-row-72 items-center gap-s3 border-b border-border-subtle px-s4 py-s2",
        isSuspended && "bg-surface",
        isOffline && "opacity-70",
      )}
    >
      <Avatar
        name={row.name}
        size="lg"
        {...(isSuspended ? {} : { status: AVATAR_STATUS_FOR_PROVIDER[row.status] })}
      />

      <span className="grow min-w-0">
        <span className="flex items-center gap-s2">
          <span className="text-emph text-text-1 truncate">{row.name}</span>
          <RatingValue value={row.rating} tight className="text-caption" />
        </span>
        <span className="block truncate text-label text-text-2">
          {row.skills.join(", ")} · {row.zone}
        </span>
        <SecondaryLine row={row} />
      </span>

      <span className="flex flex-none items-center gap-s2">
        {staleAgeMs !== null && !isSuspended ? (
          <Pill tone="warning" icon={Clock}>
            {t("roster.staleStatus", { age: formatDuration(staleAgeMs) })}
          </Pill>
        ) : null}
        <ProviderStatusIndicator status={row.status} />
      </span>
    </Link>
  );
}

function SecondaryLine({ row }: { row: ProviderRosterRow }) {
  const { t } = useTranslation("adminProviders");

  if (row.status === PROVIDER_STATUSES.suspended && row.suspendedUntil) {
    return (
      <span className="block truncate text-caption text-text-3">
        {t("roster.suspendedUntil", { date: formatDate(row.suspendedUntil) })}
      </span>
    );
  }

  if (row.currentJob) {
    return (
      <span className="block truncate text-caption text-brand">
        {row.currentJob.bookingId} · {row.currentJob.stageLabel}
      </span>
    );
  }

  if (row.status === PROVIDER_STATUSES.offline && row.lastSeenAt) {
    return (
      <span className="block truncate text-caption text-text-3">
        {t("roster.lastOnline", { age: formatRelative(row.lastSeenAt) })}
      </span>
    );
  }

  return (
    <span className="block truncate text-caption text-text-3">
      {t("roster.jobsToday", {
        count: row.jobsToday,
        earnings: formatMoney(row.earningsTodayPaise),
      })}
    </span>
  );
}
