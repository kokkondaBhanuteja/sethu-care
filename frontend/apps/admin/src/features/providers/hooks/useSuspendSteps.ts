import { useTranslation } from "@sethu/i18n";

import type { StepDefinition } from "../../../components/ui/StepRail";

/**
 * The four rail stops of the suspend flow. Action type and reason share one pane on both shells —
 * splitting them across two stops would add a click and tell the operator nothing new — but the
 * rail still shows four, because what it exists to communicate is the remaining commitment.
 */
export function useSuspendSteps(): readonly StepDefinition[] {
  const { t } = useTranslation("adminProviders");

  return [
    { id: "action", label: t("suspend.stepActionType") },
    { id: "reason", label: t("suspend.stepReason") },
    { id: "jobs", label: t("suspend.stepActiveJobs") },
    { id: "confirm", label: t("suspend.stepConfirm") },
  ];
}
