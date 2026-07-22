import { useTranslation } from "@sethu/i18n";

import { StatusDot, type DotTone } from "../../components/ui/StatusDot";
import { formatAge } from "../../lib/format";
import { ACTIVITY_KINDS, type ActivityEntry, type ActivityKind } from "./dashboard.types";

export interface ActivityTickerProps {
  entries: readonly ActivityEntry[];
}

// Routine progress is NEUTRAL on purpose: the ticker confirms the system is alive, and a column of
// green/blue/amber dots competed with the alert band for the eye (UX audit). Danger is reserved
// for a genuine failure — a cancellation is the only event here where a job died.
const TONES: Readonly<Record<ActivityKind, DotTone>> = {
  completed: "neutral",
  started: "neutral",
  en_route: "neutral",
  assigned: "neutral",
  awaiting_otp: "neutral",
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
    <ul className="m-0 list-none p-0">
      {entries.map((entry) => {
        const description = describe(entry, t);
        return (
          <li key={entry.id} className="flex items-center gap-2 py-2">
            {/* The dot's colour is never the only carrier of meaning (spec §4.8): it repeats what
                the line says, so a screen reader loses nothing by the tint being invisible. */}
            <StatusDot tone={TONES[entry.kind]} label={description} />
            <span className="min-w-0 grow text-sm text-muted">{description}</span>
            <span className="flex-none text-xs text-faint">{formatAge(entry.at)}</span>
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
