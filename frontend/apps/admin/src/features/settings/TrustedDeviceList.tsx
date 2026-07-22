import { Check, Smartphone, Tablet } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
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
}

/**
 * BOX 101. The group header carries the count so the limit is visible before an admin discovers it
 * by failing to add a fourth device; the amber note states the consequence and the remedy in one
 * line, outside the card, because it is about the group rather than any one device.
 *
 * The current device shows a CURRENT pill where the others show Revoke. Revoking it is possible
 * (BOX 102) but it is a different act, and it does not belong in the same visual slot as routinely
 * dropping an old tablet.
 */
export function TrustedDeviceList({ security, canRevoke, onRevoke }: TrustedDeviceListProps) {
  const { t } = useTranslation("adminSettings");
  const isAtLimit = security.devices.length >= security.deviceLimit;

  return (
    <SettingsGroup
      title={t("security.groupDevices", {
        used: security.devices.length,
        limit: security.deviceLimit,
      })}
      foot={isAtLimit ? t("security.deviceLimitReached") : undefined}
      footTone="warning"
    >
      <SettingsCard>
        {security.devices.map((device) => (
          <SettingsRow
            key={device.id}
            height="record"
            // The current device keeps its CURRENT pill rather than a Revoke button, but the row
            // itself opens the confirm: revoking it is possible (BOX 102), just not the same act.
            {...(device.isCurrent && canRevoke
              ? { onClick: () => onRevoke(device), affordance: "none" as const }
              : {})}
            icon={device.kind === DEVICE_KINDS.tablet ? Tablet : Smartphone}
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
                  variant="textDanger"
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
