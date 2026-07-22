import { BellOff, Moon } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { NOTIFICATION_DELIVERY, type NotificationDelivery } from "./useNotificationPermission";
import { formatClockTime } from "./settings.time";
import type { QuietHours } from "./settings.types";

export interface NotificationDeliveryBannerProps {
  delivery: NotificationDelivery;
  onEnable: () => void;
}

/**
 * BOX 61 / 98 (permission denied) and BOX 99 (critical channel off). Pinned above every group,
 * outside the scroll region, because nothing below it works until it is fixed.
 *
 * The channel-off banner names the consequence rather than the setting: the setting is on the phone,
 * the consequence is on the job, and the four locked rows below it are now lying (spec §6.30).
 */
export function NotificationDeliveryBanner({
  delivery,
  onEnable,
}: NotificationDeliveryBannerProps) {
  const { t } = useTranslation("adminSettings");

  if (delivery === NOTIFICATION_DELIVERY.ok) return null;

  const isPermissionDenied = delivery === NOTIFICATION_DELIVERY.permissionDenied;

  return (
    <Banner
      tone="danger"
      icon={BellOff}
      title={
        isPermissionDenied
          ? t("notifications.permissionDeniedTitle")
          : t("notifications.criticalChannelOffTitle")
      }
      detail={
        isPermissionDenied
          ? t("notifications.permissionDeniedBody")
          : t("notifications.criticalChannelOffBody")
      }
      actions={
        <Button variant="danger" size="inline" onClick={onEnable}>
          {isPermissionDenied
            ? t("notifications.permissionDeniedAction")
            : t("notifications.criticalChannelOffAction")}
        </Button>
      }
    />
  );
}

export interface QuietHoursBannerProps {
  quietHours: QuietHours;
  queuedCount: number;
}

/**
 * BOX 100 — informational blue, not amber: quiet hours working as configured is not a problem. The
 * queued count is included because it is the number an ops manager actually wants.
 */
export function QuietHoursBanner({ quietHours, queuedCount }: QuietHoursBannerProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <Banner
      tone="info"
      icon={Moon}
      title={t("notifications.quietHoursActive", {
        until: formatClockTime(quietHours.to),
        count: queuedCount,
      })}
    />
  );
}
