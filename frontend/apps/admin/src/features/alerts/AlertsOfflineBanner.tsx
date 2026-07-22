import { WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";

export interface AlertsOfflineBannerProps {
  isOnline: boolean;
  queuedCount: number;
}

/**
 * Offline, with the pending work counted (mobile BOX 24). Acknowledging is the one write in this
 * product that is safe to queue — it cannot double-book anyone and it cannot be raced into a wrong
 * outcome, so unlike assignment it is accepted offline and replayed on reconnect.
 *
 * The count is carried here so the pending work is legible without opening every card.
 */
export function AlertsOfflineBanner({ isOnline, queuedCount }: AlertsOfflineBannerProps) {
  const { t } = useTranslation("adminAlerts");
  const { t: tShell } = useTranslation("adminShell");

  if (isOnline) {
    if (queuedCount === 0) return null;
    return <Banner tone="info" icon={WifiOff} title={t("offline.syncing")} sticky />;
  }

  return (
    <Banner
      tone="warning"
      icon={WifiOff}
      title={
        queuedCount === 0
          ? tShell("state.offlineTitle")
          : queuedCount === 1
            ? t("offline.queuedOne")
            : t("offline.queuedMany", { count: queuedCount })
      }
      sticky
    />
  );
}
