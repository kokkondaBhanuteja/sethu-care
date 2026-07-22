import { useTranslation } from "@sethu/i18n";

import { StatusDot, type DotTone } from "../../components/ui/StatusDot";
import { formatAge } from "../../lib/format";
import { ACTIVITY_KINDS, type ActivityEntry, type ActivityKind } from "./dashboard.types";

export interface ActivityTickerProps {
  entries: readonly ActivityEntry[];
}

const TONES: Readonly<Record<ActivityKind, DotTone>> = {
  completed: "success",
  started: "info",
  en_route: "info",
  assigned: "info",
  awaiting_otp: "warning",
  cancelled_by_customer: "danger",
};

/**
 * A calm, low-priority ticker confirming the system is alive (spec §6.5). It is deliberately the
 * least urgent thing on the screen: the dot carries tone, the text carries the fact, and nothing
 * here competes with the alert band for attention.
 */
export function ActivityTicker({ entries }: ActivityTickerProps) {
  const { t } = useTranslation("adminDashboard");

  return (
    <ul className="list-none m-0 p-0">
      {entries.map((entry) => {
        const description = describe(entry, t);
        return (
          <li key={entry.id} className="flex items-center gap-s2 h-row-40">
            {/* The dot's colour is never the only carrier of meaning (spec §4.8): it repeats what
                the line says, so a screen reader loses nothing by the tint being invisible. */}
            <StatusDot tone={TONES[entry.kind]} label={description} />
            <span className="grow min-w-0 text-label text-text-1">{description}</span>
            <span className="text-caption text-text-3 flex-none">{formatAge(entry.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}

const KEYS = {
  completed: "completed",
  started: "started",
  en_route: "enRoute",
  assigned: "assigned",
  awaiting_otp: "awaitingOtp",
  cancelled_by_customer: "cancelledByCustomer",
} as const satisfies Readonly<Record<ActivityKind, string>>;

function entryKey(kind: ActivityKind): (typeof KEYS)[ActivityKind] {
  return KEYS[kind];
}

function describe(
  entry: ActivityEntry,
  t: ReturnType<typeof useTranslation<"adminDashboard">>["t"],
): string {
  if (entry.kind === ACTIVITY_KINDS.assigned) {
    return t("activity.assigned", {
      booking: entry.bookingRef,
      provider: entry.providerName ?? "",
    });
  }
  return t(`activity.${entryKey(entry.kind)}`, { booking: entry.bookingRef });
}
