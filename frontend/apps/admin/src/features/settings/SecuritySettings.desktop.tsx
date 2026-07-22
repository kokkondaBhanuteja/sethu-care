import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Topbar } from "../../layouts/Topbar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Card } from "../../components/ui/Card";
import { SkeletonList } from "../../components/ui/Skeleton";
import { LostDeviceSteps } from "./LostDeviceSteps";
import { RevokeDeviceDialog } from "./RevokeDeviceDialog";
import { SecurityEventTable } from "./SecurityEventTable";
import { SecuritySessionGroups } from "./SecuritySessionGroups";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { TrustedDeviceTable } from "./TrustedDeviceTable";
import { useSecuritySettings } from "./useSecuritySettings";
import { useSettingsCrumbs } from "./useSettingsCrumbs";
import type { TrustedDevice } from "./settings.types";

/**
 * BOX 62, with the revoke-current-device confirm of BOX 63 over it.
 *
 * The lost-device runbook is expanded rather than hidden behind a chevron: if the phone is already
 * gone the admin cannot open a sub-page on it, and the order of the steps is the advice (spec §5.7).
 */
export function SecuritySettingsDesktop() {
  const { t } = useTranslation("adminSettings");
  const security = useSecuritySettings();
  const crumbs = useSettingsCrumbs(t("security.title"));
  const [pendingDevice, setPendingDevice] = useState<TrustedDevice | null>(null);

  return (
    <>
      <Topbar crumbs={crumbs} />

      <main className="main">
        <div className="settings-col">
          <QueryBoundary
            query={security.query}
            skeleton={<SkeletonList rows={7} label={t("security.loading")} />}
          >
            {(settings) => (
              <>
                <SettingsGroup title={t("security.groupUnlock")}>
                  <SettingsCard>
                    <SettingsSwitchRow
                      label={t("security.biometricUnlockDesktop")}
                      checked={settings.biometricUnlock}
                      onCheckedChange={security.toggleBiometric}
                    />
                    <SettingsNote>{t("security.biometricNoteDesktop")}</SettingsNote>
                  </SettingsCard>
                </SettingsGroup>

                <TrustedDeviceTable
                  security={settings}
                  canRevoke={security.canRevoke}
                  onRevoke={setPendingDevice}
                />

                <SecuritySessionGroups security={settings} side />

                <SecurityEventTable events={settings.events} />

                <SettingsGroup title={t("security.groupLostDevice")}>
                  <Card>
                    <LostDeviceSteps />
                  </Card>
                </SettingsGroup>
              </>
            )}
          </QueryBoundary>
        </div>
      </main>

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
