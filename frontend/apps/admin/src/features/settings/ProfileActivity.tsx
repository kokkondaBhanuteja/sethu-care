import { Activity } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { formatDuration } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import type { AdminActivity } from "./settings.types";

export interface ProfileActivityProps {
  activity: AdminActivity;
  /** Desktop lays the four tiles in one row; the phone uses a 2x2 grid. */
  wide?: boolean;
}

/**
 * BOX 103 / 64 — the delicate card. Four numbers about one person are a performance dashboard unless
 * you say otherwise, so the card says otherwise in its own footer (spec §6.32: gentle and
 * non-punitive). The tiles are recessed grey rather than bordered white so they read as a read-out
 * rather than four things to act on, and no value is coloured — a red number would be a verdict.
 */
export function ProfileActivity({ activity, wide = false }: ProfileActivityProps) {
  const { t } = useTranslation("adminSettings");

  const tiles = [
    { id: "actions", label: t("profile.activityActions"), value: String(activity.actions) },
    {
      id: "acknowledged",
      label: t("profile.activityAcknowledged"),
      value: String(activity.escalationsAcknowledged),
    },
    {
      id: "avgAck",
      label: t("profile.activityAvgAck"),
      value: formatDuration(activity.averageAcknowledgeMs),
    },
    {
      id: "rescued",
      label: t("profile.activityRescued"),
      value: String(activity.bookingsRescued),
    },
  ];

  return (
    <SettingsGroup title={t("profile.activity")} icon={Activity}>
      <SettingsCard className="p-s4">
        <p className="mb-s3 text-pill uppercase tracking-wider text-text-3">
          {t("profile.activityPeriod")}
        </p>
        <div className={cx("grid gap-s2", wide ? "grid-cols-4" : "grid-cols-2")}>
          {tiles.map((tile) => (
            <div key={tile.id} className="flex flex-col gap-s1 rounded-card bg-surface p-s3">
              <span className="text-caption text-text-2">{tile.label}</span>
              <span className="text-section tabular-nums text-text-1">{tile.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-s3 text-caption text-text-3">{t("profile.activityFootnote")}</p>
      </SettingsCard>
    </SettingsGroup>
  );
}
