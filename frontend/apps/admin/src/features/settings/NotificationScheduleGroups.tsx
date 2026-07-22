import { Mail, Moon, Volume2 } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { formatClockTime } from "./settings.time";
import type { ConfigurableChannel, NotificationSettings } from "./settings.types";

export interface NotificationScheduleGroupsProps {
  settings: NotificationSettings;
  onToggle: (channel: ConfigurableChannel, enabled: boolean) => void;
  onQuietHoursToggle: (enabled: boolean) => void;
  onVibrateToggle: (enabled: boolean) => void;
  /** Opens the time picker for the digest delivery or either edge of the quiet-hours window. */
  onEditClock: (field: "from" | "to" | "digest") => void;
  disabled?: boolean;
  /** Mobile lists vibration alongside the alert sound; desktop has no vibration to offer. */
  withVibrate?: boolean;
  withDetails?: boolean;
}

/**
 * The digest, quiet-hours and sound groups (BOX 60 / 97).
 *
 * The quiet-hours note is not decoration: informational and operational alerts queue silently and
 * batch when the window ends, but critical alerts ignore it entirely and ring at full volume
 * (spec §6.30). An admin who does not know that will not set a window at all.
 */
export function NotificationScheduleGroups({
  settings,
  onToggle,
  onQuietHoursToggle,
  onVibrateToggle,
  onEditClock,
  disabled = false,
  withVibrate = false,
  withDetails = false,
}: NotificationScheduleGroupsProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <>
      <SettingsGroup title={t("notifications.groupDigest")} icon={Mail}>
        <SettingsCard>
          <SettingsSwitchRow
            label={t("notifications.channel.dailySummary")}
            detail={withDetails ? t("notifications.channel.dailySummaryDetail") : undefined}
            checked={settings.channels.dailySummary}
            disabled={disabled}
            onCheckedChange={(enabled) => onToggle("dailySummary", enabled)}
          />
          <SettingsRow
            height="list"
            label={t("notifications.deliveryTime")}
            value={formatClockTime(settings.digestTime)}
            onClick={() => onEditClock("digest")}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title={t("notifications.groupQuietHours")} icon={Moon}>
        <SettingsCard>
          <SettingsSwitchRow
            label={t("notifications.quietEnabled")}
            detail={withDetails ? t("notifications.quietEnabledDetail") : undefined}
            checked={settings.quietHours.enabled}
            disabled={disabled}
            onCheckedChange={onQuietHoursToggle}
          />
          <SettingsRow
            height="list"
            label={t("notifications.quietFrom")}
            value={formatClockTime(settings.quietHours.from)}
            onClick={() => onEditClock("from")}
          />
          <SettingsRow
            height="list"
            label={t("notifications.quietTo")}
            value={formatClockTime(settings.quietHours.to)}
            onClick={() => onEditClock("to")}
          />
          <SettingsNote>{t("notifications.quietNote")}</SettingsNote>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title={t(withVibrate ? "notifications.groupSound" : "notifications.groupSoundDesktop")}
        icon={Volume2}
      >
        <SettingsCard>
          <SettingsRow
            height="list"
            label={t("notifications.criticalSound")}
            value={settings.criticalSound}
          />
          {withVibrate ? (
            <SettingsSwitchRow
              label={t("notifications.vibrate")}
              checked={settings.vibrate}
              disabled={disabled}
              onCheckedChange={onVibrateToggle}
            />
          ) : null}
        </SettingsCard>
      </SettingsGroup>
    </>
  );
}
