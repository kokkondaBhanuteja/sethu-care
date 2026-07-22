import { useTranslation } from "@sethu/i18n";

import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { CHANNELS_WITH_DETAIL } from "./settings.constants";
import type { ConfigurableChannel, NotificationSettings } from "./settings.types";

export interface NotificationChannelGroupProps {
  title: string;
  channels: readonly ConfigurableChannel[];
  settings: NotificationSettings;
  onToggle: (channel: ConfigurableChannel, enabled: boolean) => void;
  /** True while the OS is discarding alerts: nothing here can do anything until that is fixed. */
  disabled?: boolean;
  withDetails?: boolean;
}

/** One freely-configurable group of notification channels (BOX 60/61/97–100). */
export function NotificationChannelGroup({
  title,
  channels,
  settings,
  onToggle,
  disabled = false,
  withDetails = false,
}: NotificationChannelGroupProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={title}>
      <SettingsCard>
        {channels.map((channel) => (
          <SettingsSwitchRow
            key={channel}
            label={t(`notifications.channel.${channel}`)}
            detail={
              withDetails && CHANNELS_WITH_DETAIL.includes(channel)
                ? t(`notifications.channel.${channel}Detail`)
                : undefined
            }
            checked={settings.channels[channel]}
            disabled={disabled}
            onCheckedChange={(enabled) => onToggle(channel, enabled)}
          />
        ))}
      </SettingsCard>
    </SettingsGroup>
  );
}
