import { useCallback } from "react";
import { useTranslation } from "@sethu/i18n";

import { ATTENTION_PRIORITIES, type AttentionPriority } from "./dashboard.types";

/**
 * One label per priority, shared by the pill, the alert band and the filtered-empty copy, so the
 * same condition is never called two different things on two screens.
 */
export function usePriorityLabel(): (priority: AttentionPriority) => string {
  const { t } = useTranslation("adminDashboard");

  return useCallback(
    (priority: AttentionPriority) => {
      switch (priority) {
        case ATTENTION_PRIORITIES.escalated:
        case ATTENTION_PRIORITIES.escalatedAcknowledged:
          return t("priority.escalated");
        case ATTENTION_PRIORITIES.slaBreached:
          return t("priority.slaBreached");
        case ATTENTION_PRIORITIES.failedAssignment:
          return t("priority.noProvider");
        case ATTENTION_PRIORITIES.slaRisk:
          return t("priority.slaRisk");
        case ATTENTION_PRIORITIES.noResponse:
          return t("priority.noResponse");
      }
    },
    [t],
  );
}
