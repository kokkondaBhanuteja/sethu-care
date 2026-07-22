import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import type { ConfigurableChannel, NotificationSettings } from "./settings.types";

export interface NotificationChannelGroupProps {
  title: string;
  icon?: LucideIcon;
  channels: readonly ConfigurableChannel[];
  settings: NotificationSettings;
  onToggle: (channel: ConfigurableChannel, enabled: boolean) => void;
  /** True while the OS is discarding alerts: nothing here can do anything until that is fixed. */
  disabled?: boolean;
  withDetails?: boolean;
}

/**
 * One freely-configurable group of notification channels (BOX 60/61/97–100). With `withDetails`,
 * every switch states its one-line consequence — a toggle whose effect the admin has to guess is
 * a toggle they leave alone.
 */
export function NotificationChannelGroup({
  title,
  icon,
  channels,
  settings,
  onToggle,
  disabled = false,
  withDetails = false,
}: NotificationChannelGroupProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={title} icon={icon}>
      <SettingsCard>
        {channels.map((channel) => (
          <SettingsSwitchRow
            key={channel}
            label={t(`notifications.channel.${channel}`)}
            detail={withDetails ? t(`notifications.channel.${channel}Detail`) : undefined}
            checked={settings.channels[channel]}
            disabled={disabled}
            onCheckedChange={(enabled) => onToggle(channel, enabled)}
          />
        ))}
      </SettingsCard>
    </SettingsGroup>
  );
}
