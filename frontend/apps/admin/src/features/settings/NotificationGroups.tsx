import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { ChoiceSheet } from "./ChoiceSheet";
import { CriticalChannelGroup } from "./CriticalChannelGroup";
import { NotificationChannelGroup } from "./NotificationChannelGroup";
import { NotificationScheduleGroups } from "./NotificationScheduleGroups";
import { OPERATIONAL_CHANNELS, PROVIDER_CHANNELS } from "./settings.constants";
import { CLOCK_OPTIONS, formatClockTime } from "./settings.time";
import { useNotificationSettings } from "./useNotificationSettings";
import type { ClockTime, NotificationSettings } from "./settings.types";

type ClockField = "from" | "to" | "digest";

export interface NotificationGroupsProps {
  settings: NotificationSettings;
  controls: ReturnType<typeof useNotificationSettings>;
  /** True while the OS refuses to deliver: every configurable switch below is inert (BOX 61/98). */
  disabled?: boolean;
  withVibrate?: boolean;
  withDetails?: boolean;
}

/**
 * The six notification groups, shared by both surfaces so the tiers can never diverge between them
 * (spec §2.1's anti-drift rule). Only the width and two rows differ, and those are props.
 */
export function NotificationGroups({
  settings,
  controls,
  disabled = false,
  withVibrate = false,
  withDetails = false,
}: NotificationGroupsProps) {
  const { t } = useTranslation("adminSettings");
  const [editing, setEditing] = useState<ClockField | null>(null);

  const clockValue: ClockTime =
    editing === "digest"
      ? settings.digestTime
      : editing === "to"
        ? settings.quietHours.to
        : settings.quietHours.from;

  const applyClock = (value: ClockTime) => {
    if (editing === "digest") controls.setDigestTime(value);
    else if (editing) controls.setQuietHour(editing, value);
  };

  return (
    <>
      <CriticalChannelGroup withDetails={withDetails} />

      <NotificationChannelGroup
        title={t("notifications.groupOperational")}
        channels={OPERATIONAL_CHANNELS}
        settings={settings}
        onToggle={controls.toggleChannel}
        disabled={disabled}
        withDetails={withDetails}
      />

      <NotificationChannelGroup
        title={t("notifications.groupProvider")}
        channels={PROVIDER_CHANNELS}
        settings={settings}
        onToggle={controls.toggleChannel}
        disabled={disabled}
        withDetails={withDetails}
      />

      <NotificationScheduleGroups
        settings={settings}
        onToggle={controls.toggleChannel}
        onQuietHoursToggle={controls.toggleQuietHours}
        onVibrateToggle={controls.toggleVibrate}
        onEditClock={setEditing}
        disabled={disabled}
        withVibrate={withVibrate}
        withDetails={withDetails}
      />

      <ChoiceSheet
        isOpen={editing !== null}
        title={t(
          editing === "digest" ? "notifications.deliveryTime" : "notifications.groupQuietHours",
        )}
        value={clockValue}
        options={CLOCK_OPTIONS.map((option) => ({ value: option, label: formatClockTime(option) }))}
        onSelect={applyClock}
        onDismiss={() => setEditing(null)}
      />
    </>
  );
}
