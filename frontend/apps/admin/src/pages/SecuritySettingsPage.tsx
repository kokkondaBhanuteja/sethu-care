import { SecuritySettingsDesktop } from "../features/settings/SecuritySettings.desktop";
import { SecuritySettingsMobile } from "../features/settings/SecuritySettings.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** BOX 62/63 on desktop, BOX 101/102 on mobile. */
export default function SecuritySettingsPage() {
  return useIsDesktop() ? <SecuritySettingsDesktop /> : <SecuritySettingsMobile />;
}
