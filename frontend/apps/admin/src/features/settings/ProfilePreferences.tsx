import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Segmented } from "../../components/ui/Segmented";
import { MOBILE_TABS } from "../../layouts/navigation.constants";
import { ChoiceSheet } from "./ChoiceSheet";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSwitchRow } from "./SettingsSwitchRow";
import { APPEARANCE_MODES } from "./settings.constants";
import type { AdminPreferences, AppearanceMode } from "./settings.types";

export interface ProfilePreferencesProps {
  preferences: AdminPreferences;
  onChange: (preferences: AdminPreferences) => void;
  /** Desktop calls the same two rows "Sound effects" and "Default landing page". */
  wide?: boolean;
}

/** BOX 103 / 64 — appearance, haptics and the tab the app opens on (spec §6.32). */
export function ProfilePreferences({
  preferences,
  onChange,
  wide = false,
}: ProfilePreferencesProps) {
  const { t } = useTranslation("adminSettings");
  const shellT = useTranslation("adminShell").t;
  const [isLandingOpen, setIsLandingOpen] = useState(false);

  const landingOptions = MOBILE_TABS.map((tab) => ({
    value: tab.tab,
    label: shellT(tab.labelKey),
  }));
  const landingLabel =
    landingOptions.find((option) => option.value === preferences.defaultLandingRoute)?.label ?? "";

  return (
    <>
      <SettingsGroup title={t("profile.preferences")} icon={SlidersHorizontal}>
        <SettingsCard>
          <SettingsRow
            height="detail"
            label={t("profile.appearance")}
            control={
              <Segmented<AppearanceMode>
                label={t("profile.appearance")}
                value={preferences.appearance}
                options={APPEARANCE_MODES.map((mode) => ({
                  value: mode,
                  label: t(`profile.appearance${mode.charAt(0).toUpperCase()}${mode.slice(1)}`),
                }))}
                onValueChange={(appearance) => onChange({ ...preferences, appearance })}
              />
            }
          />
          <SettingsSwitchRow
            label={wide ? t("profile.soundEffects") : t("profile.haptics")}
            checked={preferences.haptics}
            onCheckedChange={(haptics) => onChange({ ...preferences, haptics })}
          />
          <SettingsRow
            height="list"
            label={wide ? t("profile.defaultLanding") : t("profile.defaultTab")}
            value={landingLabel}
            onClick={() => setIsLandingOpen(true)}
          />
        </SettingsCard>
      </SettingsGroup>

      <ChoiceSheet
        isOpen={isLandingOpen}
        title={wide ? t("profile.defaultLanding") : t("profile.defaultTab")}
        value={preferences.defaultLandingRoute}
        options={landingOptions}
        onSelect={(defaultLandingRoute) => onChange({ ...preferences, defaultLandingRoute })}
        onDismiss={() => setIsLandingOpen(false)}
      />
    </>
  );
}
