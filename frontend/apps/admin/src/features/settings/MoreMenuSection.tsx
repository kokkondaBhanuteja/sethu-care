import { useTranslation } from "@sethu/i18n";

import { Badge } from "../../components/ui/Badge";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { useAdminProfile } from "./useAdminProfile";
import type { MoreMenuItem } from "./settings.constants";
import type { ShellCounters } from "../../queries/shell.types";

export interface MoreMenuSectionProps {
  title: string;
  items: readonly MoreMenuItem[];
  foot?: string;
  /** The "On desktop" group is drawn a step lighter and links out rather than deeper. */
  muted?: boolean;
  counters?: ShellCounters;
}

/** One group of the More menu. Muted rows carry a link-out arrow, never a chevron (spec §6.22). */
export function MoreMenuSection({
  title,
  items,
  foot,
  muted = false,
  counters,
}: MoreMenuSectionProps) {
  const { t } = useTranslation("adminSettings");
  const appearance = useAdminProfile().query.data?.preferences.appearance;

  return (
    <SettingsGroup title={title} foot={foot}>
      <SettingsCard muted={muted}>
        {items.map((item) => {
          const count = item.badge && counters ? counters[item.badge] : 0;
          const label = t(item.labelKey);
          return (
            <SettingsRow
              key={item.to}
              icon={item.icon}
              label={label}
              to={item.to}
              external={muted}
              value={
                item.valueFrom === "appearance" && appearance
                  ? t(`profile.appearance${capitalise(appearance)}`)
                  : undefined
              }
              control={count > 0 ? <Badge count={count} label={label} tone="brand" /> : undefined}
            />
          );
        })}
      </SettingsCard>
    </SettingsGroup>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
