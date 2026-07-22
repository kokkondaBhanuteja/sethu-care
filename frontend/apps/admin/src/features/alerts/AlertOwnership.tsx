import { useTranslation } from "@sethu/i18n";

import { formatTime } from "../../lib/format";
import type { Alert } from "./alerts.types";

export interface AlertOwnershipProps {
  alert: Alert;
}

/**
 * Ownership, stated in words. Acknowledging is a claim of responsibility, not a resolution — and an
 * admin who reads "acknowledged" as "handled" is the failure mode the whole feed exists to prevent,
 * so the caption says so out loud (spec §6.20, §6.21).
 */
export function AlertOwnership({ alert }: AlertOwnershipProps) {
  const { t } = useTranslation("adminAlerts");

  if (!alert.requiresAcknowledgement) {
    return (
      <div>
        <p className="m-0 text-emph text-text-2">{t("ownership.none")}</p>
        <p className="mt-s1 mb-0 text-caption text-text-3">{t("ownership.noneNote")}</p>
      </div>
    );
  }

  const owner = alert.acknowledgement;
  if (!owner) {
    return (
      <div>
        <p className="m-0 text-emph text-danger">{t("ownership.unowned")}</p>
        <p className="mt-s1 mb-0 text-caption text-text-3">{t("ownership.unownedNote")}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="m-0 text-emph text-success">
        {t("ownership.owned", {
          name: owner.adminName,
          time: formatTime(owner.acknowledgedAt),
        })}
      </p>
      <p className="mt-s1 mb-0 text-caption text-text-3">{t("ownership.ownedNote")}</p>
    </div>
  );
}
