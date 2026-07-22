import { useTranslation } from "@sethu/i18n";

import type { StepDefinition } from "../../../components/ui/StepRail";

/**
 * The three rail stops of the suspend flow — one per pane, so the counter never jumps. Action
 * type and reason share the first pane (splitting them across two stops would add a click and
 * tell the operator nothing new), and the rail says so with one honest "Action & reason" stop.
 */
export function useSuspendSteps(): readonly StepDefinition[] {
  const { t } = useTranslation("adminProviders");

  return [
    { id: "actionReason", label: t("suspend.stepActionReason") },
    { id: "jobs", label: t("suspend.stepActiveJobs") },
    { id: "confirm", label: t("suspend.stepConfirm") },
  ];
}
