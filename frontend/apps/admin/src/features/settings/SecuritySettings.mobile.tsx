import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonList } from "../../components/ui/Skeleton";
import { LostDeviceSteps } from "./LostDeviceSteps";
import { RevokeDeviceDialog } from "./RevokeDeviceDialog";
import { SecurityEventList } from "./SecurityEventList";
import { SecuritySessionGroups } from "./SecuritySessionGroups";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { TrustedDeviceList } from "./TrustedDeviceList";
import { useSecuritySettings } from "./useSecuritySettings";
import type { TrustedDevice } from "./settings.types";

/** BOX 101, with the revoke-current-device confirm of BOX 102 over it. */
export function SecuritySettingsMobile() {
  const { t } = useTranslation("adminSettings");
  const security = useSecuritySettings();
  const [pendingDevice, setPendingDevice] = useState<TrustedDevice | null>(null);
  const [isRunbookOpen, setIsRunbookOpen] = useState(false);

  return (
    <>
      <MobileAppBar title={t("security.title")} showBack compact onSurface />

      <div className="screen__scroll bg-surface pt-s2">
        <QueryBoundary
          query={security.query}
          skeleton={
            <div className="px-s4">
              <SkeletonList rows={7} label={t("security.loading")} />
            </div>
          }
        >
          {(settings) => (
            <>
              <SettingsGroup title={t("security.groupUnlock")}>
                <SettingsCard>
                  <SettingsSwitchRow
                    label={t("security.biometricUnlock")}
                    checked={settings.biometricUnlock}
                    onCheckedChange={security.toggleBiometric}
                  />
                  <SettingsNote>{t("security.biometricNote")}</SettingsNote>
                </SettingsCard>
              </SettingsGroup>

              <TrustedDeviceList
                security={settings}
                canRevoke={security.canRevoke}
                onRevoke={setPendingDevice}
              />

              <SecuritySessionGroups security={settings} />

              <SecurityEventList events={settings.events} />

              <SettingsGroup title={t("security.groupLostDevice")}>
                <SettingsCard>
                  <SettingsRow
                    label={t("security.lostDeviceRow")}
                    onClick={() => setIsRunbookOpen(true)}
                  />
                </SettingsCard>
              </SettingsGroup>
            </>
          )}
        </QueryBoundary>
      </div>

      <Sheet
        isOpen={isRunbookOpen}
        title={t("security.groupLostDevice")}
        onDismiss={() => setIsRunbookOpen(false)}
      >
        <LostDeviceSteps />
      </Sheet>

      <RevokeDeviceDialog
        device={pendingDevice}
        isRevoking={security.isRevoking}
        onConfirm={(device) => {
          security.revoke(device);
          setPendingDevice(null);
        }}
        onDismiss={() => setPendingDevice(null)}
      />
    </>
  );
}
