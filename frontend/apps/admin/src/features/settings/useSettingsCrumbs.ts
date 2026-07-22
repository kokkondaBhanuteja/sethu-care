import { useTranslation } from "@sethu/i18n";

import { ROUTES } from "../../routes/routes.constants";
import type { Crumb } from "../../layouts/Topbar";

/**
 * Every settings screen on desktop is reached from the same place, so they all carry the same
 * two-segment breadcrumb: Settings / <screen>. The parent points at notification settings because
 * desktop has no settings index — the sidebar's ACCOUNT group is the index (BOX 59).
 */
export function useSettingsCrumbs(current: string): readonly Crumb[] {
  const { t } = useTranslation("adminShell");
  return [{ label: t("nav.settings"), to: ROUTES.notificationSettings }, { label: current }];
}
