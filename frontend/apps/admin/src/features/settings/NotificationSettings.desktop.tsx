import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotificationDeliveryBanner } from "./NotificationDeliveryBanner";
import { NotificationGroups } from "./NotificationGroups";
import { SettingsAside } from "./SettingsAside";
import { SettingsShell } from "./SettingsShell";
import { SETTINGS_SECTION_IDS } from "./settings.constants";
import { useNotificationPermission } from "./useNotificationPermission";
import { useNotificationSettings } from "./useNotificationSettings";

/**
 * BOX 60, and BOX 61 when the browser is refusing to deliver — inside the unified Settings frame.
 *
 * The reading column stays narrow: a settings form stretched across 1440px forces the eye to travel
 * the width of the screen between a label and its switch. The explainer floats beside it, answering
 * the question the locked rows raise without interrupting the list.
 */
export function NotificationSettingsDesktop() {
  const { t } = useTranslation("adminSettings");
  const controls = useNotificationSettings();
  const permission = useNotificationPermission();

  return (
    <SettingsShell
      section={SETTINGS_SECTION_IDS.notifications}
      aside={
        <SettingsAside title={t("notifications.explainerTitle")}>
          {t("notifications.explainerBody")}
        </SettingsAside>
      }
    >
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
    </SettingsShell>
  );
}
