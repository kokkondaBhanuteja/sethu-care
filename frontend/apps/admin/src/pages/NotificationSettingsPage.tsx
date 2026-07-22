import { NotificationSettingsDesktop } from "../features/settings/NotificationSettings.desktop";
import { NotificationSettingsMobile } from "../features/settings/NotificationSettings.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** BOX 60/61 on desktop, BOX 97–100 on mobile. */
export default function NotificationSettingsPage() {
  return useIsDesktop() ? <NotificationSettingsDesktop /> : <NotificationSettingsMobile />;
}
