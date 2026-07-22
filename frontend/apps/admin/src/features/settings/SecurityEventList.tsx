import { History } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { StatusDot } from "../../components/ui/StatusDot";
import { formatDateTime } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SECURITY_EVENT_KINDS } from "./settings.constants";
import type { SecurityEvent } from "./settings.types";

export interface SecurityEventListProps {
  events: readonly SecurityEvent[];
}

/** Whether an event is routine or is the one worth looking at (BOX 101 / 62). */
export function eventTone(event: SecurityEvent): "success" | "warning" {
  return event.kind === SECURITY_EVENT_KINDS.failedSignIn ? "warning" : "success";
}

/**
 * BOX 101 — recent security events on the phone. The failed attempt keeps its amber dot and leaves
 * the unknown device and location as words rather than dashes, because "unknown" is the finding.
 */
export function SecurityEventList({ events }: SecurityEventListProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={t("security.groupEvents")} icon={History}>
      <SettingsCard>
        {events.map((event) => {
          const tone = eventTone(event);
          const label = t(`security.event.${event.kind}`);
          return (
            <div
              key={event.id}
              className="flex min-h-row-60 items-center gap-s3 border-t border-border-subtle px-s4 py-s2 first:border-t-0"
            >
              <StatusDot tone={tone} label={label} />
              <span className="grow min-w-0">
                <span className="block text-label text-text-1">
                  {t("security.eventLine", {
                    event: label,
                    device: event.device ?? t("security.event.unknown"),
                    location: event.location ?? t("security.event.unknown"),
                  })}
                </span>
                <span className="block text-caption text-text-3">
                  {formatDateTime(event.atIso)}
                </span>
              </span>
            </div>
          );
        })}
      </SettingsCard>
    </SettingsGroup>
  );
}
