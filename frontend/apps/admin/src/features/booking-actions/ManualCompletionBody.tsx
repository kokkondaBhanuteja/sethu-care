import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { SkeletonList } from "../../components/ui/Skeleton";
import { ManualCompletionConfirmStep } from "./ManualCompletionConfirmStep";
import { ManualCompletionEvidenceStep } from "./ManualCompletionEvidenceStep";
import { ManualCompletionReasonStep, ManualCompletionVerifyStep } from "./ManualCompletionSteps";
import type { ManualCompletionState } from "./useManualCompletion";

export interface ManualCompletionBodyProps {
  state: ManualCompletionState;
  onLogCallAttempt: () => void;
}

/** Renders whichever of the four steps is active. Both shells drive the same steps. */
export function ManualCompletionBody({ state, onLogCallAttempt }: ManualCompletionBodyProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <QueryBoundary
      query={state.query}
      skeleton={<SkeletonList rows={4} rowClassName="h-row-56" label={t("manual.loading")} />}
    >
      {(data) => {
        if (state.stepIndex === 0) return <ManualCompletionReasonStep state={state} />;
        if (state.stepIndex === 1) {
          return (
            <ManualCompletionEvidenceStep
              context={data}
              gaps={state.gaps}
              onLogCallAttempt={onLogCallAttempt}
            />
          );
        }
        if (state.stepIndex === 2) return <ManualCompletionVerifyStep state={state} />;
        return <ManualCompletionConfirmStep context={data} />;
      }}
    </QueryBoundary>
  );
}
