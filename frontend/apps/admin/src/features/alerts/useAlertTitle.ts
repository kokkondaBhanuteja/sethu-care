import { useCallback } from "react";
import { useTranslation } from "@sethu/i18n";

import { ALERT_TITLE_KEYS } from "./alerts.constants";
import type { AlertTitleParams, AlertType } from "./alerts.types";

export interface TitledAlert {
  readonly type: AlertType;
  readonly titleParams: AlertTitleParams;
}

/**
 * An alert's headline. The sentence belongs to the client (so it translates) and the nouns belong to
 * the server (so "Ajay Verma" is not in a locale file) — this is the join.
 */
export function useAlertTitle(): (alert: TitledAlert) => string {
  const { t } = useTranslation("adminAlerts");

  return useCallback(
    (alert: TitledAlert) => t(ALERT_TITLE_KEYS[alert.type], alert.titleParams),
    [t],
  );
}
