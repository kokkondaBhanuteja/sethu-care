import { useParams } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { NotFoundState } from "../components/ui/states/NotFoundState";
import { AlertDetailDesktop } from "../features/alerts/AlertDetail.desktop";
import { AlertDetailMobile } from "../features/alerts/AlertDetail.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/**
 * `/alerts/:alertId` — spec §6.21. This is a push-notification target, so a malformed or missing id
 * renders the not-found state rather than throwing (spec §3.4 rule 3).
 */
export default function AlertDetailPage() {
  const { alertId } = useParams();
  const { t } = useTranslation("adminAlerts");
  const isDesktop = useIsDesktop();

  if (!alertId) return <NotFoundState subject={t("notFoundSubject")} />;

  return isDesktop ? (
    <AlertDetailDesktop alertId={alertId} />
  ) : (
    <AlertDetailMobile alertId={alertId} />
  );
}
