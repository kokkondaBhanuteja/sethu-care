import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { SkeletonList } from "../../components/ui/Skeleton";
import { CancelBookingForm } from "./CancelBookingForm";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { MobileActionScreen } from "./MobileActionScreen";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { cancelSummaryLine } from "./cancelSummary";
import type { CancelBookingState } from "./useCancelBooking";

/**
 * BOX 43–47. The screen leads with consequence, not with the form: the impact card names the three
 * parties this action moves before a reason has been picked. The reason list is cheap to fill in;
 * an unrecoverable cancellation is not.
 */
export function CancelBookingMobile({ state }: { state: CancelBookingState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;

  return (
    <>
      <MobileActionScreen
        title={t("cancel.title")}
        {...(context ? { reference: context.booking.reference } : {})}
        onClose={state.requestExit}
        footer={
          <Button
            variant="danger"
            size="primary"
            block
            isLoading={state.form.isSubmitting}
            onClick={() => void state.form.handleSubmit()}
          >
            {t("cancel.continueToConfirm")}
          </Button>
        }
      >
        <div className="px-s4 pt-s4">
          <QueryBoundary
            query={state.query}
            skeleton={<SkeletonList rows={5} rowClassName="h-row-56" label={t("cancel.loading")} />}
          >
            {(data) => <CancelBookingForm context={data} state={state} />}
          </QueryBoundary>
        </div>
      </MobileActionScreen>

      <StepUpChallenge
        stepUp={state.stepUp}
        tone="danger"
        title={t("cancel.confirmTitle")}
        summary={cancelSummaryLine(context ?? null, state.form.form.watch(), t)}
        // "Confirm", not "Confirm with biometrics": the challenge collects a passcode and no
        // biometric plugin is installed — the label must not promise what the field is not.
        confirmLabel={tShell("actions.confirm")}
      />

      <DiscardChangesPrompt
        isOpen={state.discard.isPrompting}
        isDesktop={false}
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
