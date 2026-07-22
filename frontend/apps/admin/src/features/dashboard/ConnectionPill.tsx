import { WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../components/ui/Pill";
import { StatusDot } from "../../components/ui/StatusDot";
import { CONNECTION_STATUSES, type ConnectionStatus } from "./useConnectionStatus";

export interface ConnectionPillProps {
  status: ConnectionStatus;
}

/**
 * The same slot in the header for all three states, so the eye already knows where to look — but
 * colour, icon and label all change together, never colour alone (spec §4.8).
 */
export function ConnectionPill({ status }: ConnectionPillProps) {
  const { t } = useTranslation("adminDashboard");

  if (status === CONNECTION_STATUSES.offline) {
    return (
      <Pill tone="neutral" icon={WifiOff}>
        {t("live.statusOffline")}
      </Pill>
    );
  }

  if (status === CONNECTION_STATUSES.reconnecting) {
    return (
      <Pill tone="warning">
        <StatusDot tone="warning" size="sm" pulse label={t("live.statusReconnecting")} />
        {t("live.statusReconnecting")}
      </Pill>
    );
  }

  return (
    <Pill tone="success">
      <StatusDot tone="success" size="sm" label={t("live.statusLive")} />
      {t("live.statusLive")}
    </Pill>
  );
}
