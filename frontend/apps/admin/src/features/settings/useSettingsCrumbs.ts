import { useTranslation } from "@sethu/i18n";

import { ROUTES } from "../../routes/routes.constants";
import type { Crumb } from "../../layouts/Topbar";

/**
 * Every desktop settings screen renders inside the unified `SettingsShell`, so they all carry the
 * same two-segment breadcrumb: Settings / <section>. There is no /settings index route — the
 * shell's own sub-nav is the index — so the parent crumb points at the first section it lists
 * after Profile that lives under /settings, which is notifications.
 */
export function useSettingsCrumbs(current: string): readonly Crumb[] {
  const { t } = useTranslation("adminShell");
  return [{ label: t("nav.settings"), to: ROUTES.notificationSettings }, { label: current }];
}
