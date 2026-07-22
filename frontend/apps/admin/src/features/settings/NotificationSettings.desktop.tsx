import { useTranslation } from "@sethu/i18n";

import { Topbar } from "../../layouts/Topbar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotificationDeliveryBanner } from "./NotificationDeliveryBanner";
import { NotificationGroups } from "./NotificationGroups";
import { SettingsAside } from "./SettingsAside";
import { useNotificationPermission } from "./useNotificationPermission";
import { useNotificationSettings } from "./useNotificationSettings";
import { useSettingsCrumbs } from "./useSettingsCrumbs";

/**
 * BOX 60, and BOX 61 when the browser is refusing to deliver.
 *
 * The column is held to 720px: a settings form stretched across 1440px forces the eye to travel the
 * width of the screen between a label and its switch. The explainer floats in the space that leaves.
 */
export function NotificationSettingsDesktop() {
  const { t } = useTranslation("adminSettings");
  const controls = useNotificationSettings();
  const permission = useNotificationPermission();
  const crumbs = useSettingsCrumbs(t("notifications.title"));

  return (
    <>
      <Topbar crumbs={crumbs} />

      <main className="main">
        <div className="settings-layout">
          <div className="settings-col">
            <NotificationDeliveryBanner
              delivery={permission.delivery}
              onEnable={() => void permission.requestPermission()}
            />

            <QueryBoundary
              query={controls.query}
              skeleton={<SkeletonList rows={8} label={t("notifications.loading")} />}
            >
              {(settings) => (
                <NotificationGroups
                  settings={settings}
                  controls={controls}
                  disabled={permission.areChannelsInert}
                  withDetails
                />
              )}
            </QueryBoundary>
          </div>

          <SettingsAside title={t("notifications.explainerTitle")}>
            {t("notifications.explainerBody")}
          </SettingsAside>
        </div>
      </main>
    </>
  );
}
