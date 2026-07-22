import { useState } from "react";
import { Fingerprint, PhoneOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Card } from "../../components/ui/Card";
import { SkeletonList } from "../../components/ui/Skeleton";
import { LostDeviceSteps } from "./LostDeviceSteps";
import { RevokeDeviceDialog } from "./RevokeDeviceDialog";
import { SecurityEventTable } from "./SecurityEventTable";
import { SecuritySessionGroups } from "./SecuritySessionGroups";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsShell } from "./SettingsShell";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { TrustedDeviceList } from "./TrustedDeviceList";
import { SETTINGS_SECTION_IDS } from "./settings.constants";
import { useSecuritySettings } from "./useSecuritySettings";
import type { TrustedDevice } from "./settings.types";

/**
 * BOX 62, with the revoke-current-device confirm of BOX 63 over it — inside the unified Settings
 * frame. Trusted devices render as identity rows with the revoke affordance on the row, and the
 * biometric switch states its idle-timeout trade-off in plain words.
 *
 * The lost-device runbook is expanded rather than hidden behind a chevron: if the phone is already
 * gone the admin cannot open a sub-page on it, and the order of the steps is the advice (spec §5.7).
 */
export function SecuritySettingsDesktop() {
  const { t } = useTranslation("adminSettings");
  const security = useSecuritySettings();
  const [pendingDevice, setPendingDevice] = useState<TrustedDevice | null>(null);

  return (
    <SettingsShell section={SETTINGS_SECTION_IDS.security}>
      <QueryBoundary
        query={security.query}
        skeleton={<SkeletonList rows={7} label={t("security.loading")} />}
      >
        {(settings) => (
          <>
            <SettingsGroup title={t("security.groupUnlock")} icon={Fingerprint}>
              <SettingsCard>
                <SettingsSwitchRow
                  label={t("security.biometricUnlockDesktop")}
                  detail={t("security.biometricDetail")}
                  checked={settings.biometricUnlock}
                  onCheckedChange={security.toggleBiometric}
                />
                <SettingsNote>{t("security.biometricNoteDesktop")}</SettingsNote>
              </SettingsCard>
            </SettingsGroup>

            <TrustedDeviceList
              security={settings}
              canRevoke={security.canRevoke}
              onRevoke={setPendingDevice}
              withRevokeButton
            />

            <SecuritySessionGroups security={settings} side />

            <SecurityEventTable events={settings.events} />

            <SettingsGroup title={t("security.groupLostDevice")} icon={PhoneOff}>
              <Card>
                <LostDeviceSteps />
              </Card>
            </SettingsGroup>
          </>
        )}
      </QueryBoundary>

      <RevokeDeviceDialog
        device={pendingDevice}
        isRevoking={security.isRevoking}
        onConfirm={(device) => {
          security.revoke(device);
          setPendingDevice(null);
        }}
        onDismiss={() => setPendingDevice(null)}
      />
    </SettingsShell>
  );
}
