import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotificationDeliveryBanner, QuietHoursBanner } from "./NotificationDeliveryBanner";
import { NotificationGroups } from "./NotificationGroups";
import { SettingsLead } from "./SettingsGroup";
import { isQuietHoursActive } from "./settings.time";
import { useNotificationPermission } from "./useNotificationPermission";
import { useNotificationSettings } from "./useNotificationSettings";

/**
 * BOX 97, with its three state variants: OS permission denied (98), critical channel off (99) and
 * quiet hours active (100). Each banner sits OUTSIDE `.screen__scroll` so it cannot be scrolled
 * away — the two danger states describe a condition that makes everything below them meaningless.
 */
export function NotificationSettingsMobile() {
  const { t } = useTranslation("adminSettings");
  const controls = useNotificationSettings();
  const permission = useNotificationPermission();

  return (
    <>
      <MobileAppBar title={t("notifications.title")} showBack compact onSurface />

      <NotificationDeliveryBanner
        delivery={permission.delivery}
        onEnable={() => void permission.requestPermission()}
      />

      {controls.query.data &&
      (permission.forceQuietHours || isQuietHoursActive(controls.query.data.quietHours)) ? (
        <QuietHoursBanner
          quietHours={controls.query.data.quietHours}
          queuedCount={controls.query.data.queuedDuringQuietHours}
        />
      ) : null}

      <div className="screen__scroll bg-surface pt-s2">
        <SettingsLead>{t("sections.notificationsDescription")}</SettingsLead>

        <QueryBoundary
          query={controls.query}
          skeleton={
            <div className="px-s4">
              <SkeletonList rows={8} label={t("notifications.loading")} />
            </div>
          }
        >
          {(settings) => (
            <NotificationGroups
              settings={settings}
              controls={controls}
              disabled={permission.areChannelsInert}
              withVibrate
            />
          )}
        </QueryBoundary>
      </div>
    </>
  );
}
