import { Check, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatRelative } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { DEVICE_KINDS } from "./settings.constants";
import type { SecuritySettings, TrustedDevice } from "./settings.types";

export interface TrustedDeviceListProps {
  security: SecuritySettings;
  canRevoke: boolean;
  onRevoke: (device: TrustedDevice) => void;
  /** Desktop widens the revoke affordance from a text link to an outlined button. */
  withRevokeButton?: boolean;
}

/**
 * BOX 62 / 101, shared by both surfaces so the rows can never diverge: each trusted device as an
 * identity row — device chip, name, then WHEN and WHERE it was last used — with the revoke
 * affordance on the row itself, not behind a menu. The group header carries the count so the limit
 * is visible before an admin discovers it by failing to add a fourth device.
 *
 * The current device shows a CURRENT pill where the others show Revoke. Revoking it is possible
 * (BOX 102) but it is a different act, and it does not belong in the same visual slot as routinely
 * dropping an old tablet — so the row itself opens the confirm instead.
 */
export function TrustedDeviceList({
  security,
  canRevoke,
  onRevoke,
  withRevokeButton = false,
}: TrustedDeviceListProps) {
  const { t } = useTranslation("adminSettings");
  const isAtLimit = security.devices.length >= security.deviceLimit;

  return (
    <SettingsGroup
      title={t("security.groupDevices", {
        used: security.devices.length,
        limit: security.deviceLimit,
      })}
      icon={MonitorSmartphone}
      foot={isAtLimit ? t("security.deviceLimitReached") : undefined}
      footTone="warning"
    >
      <SettingsCard>
        {security.devices.map((device) => (
          <SettingsRow
            key={device.id}
            height="record"
            {...(device.isCurrent && canRevoke
              ? { onClick: () => onRevoke(device), affordance: "none" as const }
              : {})}
            leading={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset">
                <Icon
                  glyph={device.kind === DEVICE_KINDS.tablet ? Tablet : Smartphone}
                  size="nav"
                  className="text-text-2"
                />
              </span>
            }
            label={device.name}
            detail={
              device.isCurrent
                ? t("security.deviceCurrentMeta", { location: device.location })
                : t("security.deviceMeta", {
                    lastUsed: formatRelative(device.lastUsedIso),
                    location: device.location,
                  })
            }
            control={
              device.isCurrent ? (
                <Pill tone="success" icon={Check}>
                  {t("security.current")}
                </Pill>
              ) : (
                <Button
                  variant={withRevokeButton ? "outlineDanger" : "textDanger"}
                  size="inline"
                  disabled={!canRevoke}
                  onClick={() => onRevoke(device)}
                >
                  {t("security.revoke")}
                </Button>
              )
            }
          />
        ))}
      </SettingsCard>
    </SettingsGroup>
  );
}
