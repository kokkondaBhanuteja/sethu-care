import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { CRITICAL_CHANNELS } from "./settings.constants";

export interface CriticalChannelGroupProps {
  /** Desktop draws the one-line consequence under each name; the phone has no room for it. */
  withDetails?: boolean;
}

/**
 * BOX 60 / 97 — the four alert types that cannot be silenced (spec §6.30).
 *
 * A lock where every other row has a switch is the screen, not an omission. A greyed-out switch
 * reads as "broken, try later"; an absent switch with a lock reads as "this is a decision". The lock
 * is paired with the in-card sentence because an icon must never be the only carrier of meaning.
 */
export function CriticalChannelGroup({ withDetails = false }: CriticalChannelGroupProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={t("notifications.groupCritical")} tone="danger">
      <SettingsCard tone="danger">
        {CRITICAL_CHANNELS.map((channel) => (
          <SettingsRow
            key={channel}
            height="list"
            label={t(`notifications.channel.${channel}`)}
            detail={withDetails ? t(`notifications.channel.${channel}Detail`) : undefined}
            control={
              <Icon
                glyph={Lock}
                className="shrink-0 text-text-3"
                label={t("notifications.criticalLocked")}
              />
            }
          />
        ))}
        <SettingsNote>{t("notifications.criticalNote")}</SettingsNote>
      </SettingsCard>
    </SettingsGroup>
  );
}
