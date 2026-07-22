import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Stepper } from "../../components/ui/StepRail";
import { BookingContextStrip } from "./BookingContextStrip";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { ManualCompletionBody } from "./ManualCompletionBody";
import {
  ManualCompletionBypassNotice,
  ManualCompletionTooEarly,
  OtpArrivedInterrupt,
} from "./ManualCompletionNotices";
import { MobileActionScreen } from "./MobileActionScreen";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { MANUAL_COMPLETION_STEP_IDS } from "./booking-actions.constants";
import { canLeaveStep } from "./manualCompletionGates";
import type { ManualCompletionState } from "./useManualCompletion";

/**
 * BOX 52–59. The step counter and the four-segment bar sit outside the scroll region: the operator
 * must be able to see how far in they are — and how far is left — at every scroll position.
 */
export function ManualCompletionMobile({ state }: { state: ManualCompletionState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;
  const canContinue = canLeaveStep(state.stepIndex, state.form.form.watch(), state.gaps);
  const stepCount = MANUAL_COMPLETION_STEP_IDS.length;

  if (context?.availableInMinutes != null) {
    return (
      <ManualCompletionTooEarly
        availableInMinutes={context.availableInMinutes}
        onBack={state.requestExit}
      />
    );
  }

  return (
    <>
      <MobileActionScreen
        title={t("manual.title")}
        reference={t("manual.stepCounter", { index: state.stepIndex + 1, count: stepCount })}
        onClose={state.stepIndex === 0 ? state.requestExit : state.goBack}
        aboveScroll={
          <>
            <div className="flex-none px-s4 pb-s3">
              <Stepper
                count={stepCount}
                activeIndex={state.stepIndex}
                label={t("manual.stepsLabel")}
              />
            </div>
            {context ? (
              <BookingContextStrip
                text={t("manual.contextStrip", {
                  reference: context.booking.reference,
                  service: context.booking.serviceName,
                  provider: context.providerName,
                  minutes: context.minutesSinceWorkReported,
                })}
              />
            ) : null}
          </>
        }
        footerNote={
          state.stepIndex === 1 && !state.gaps.isSatisfied ? (
            <span className="text-caption text-danger">{t("manual.evidenceBlockedNote")}</span>
          ) : undefined
        }
        footer={
          state.isLastStep ? (
            // "Confirm", not "Confirm with biometrics": the step-up collects a passcode and no
            // biometric plugin is installed — the label must not promise what the field is not.
            <Button
              variant="primary"
              size="primary"
              block
              isLoading={state.form.isSubmitting}
              onClick={() => void state.form.handleSubmit()}
            >
              {tShell("actions.confirm")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="primary"
              block
              disabled={!canContinue}
              onClick={state.goNext}
            >
              {t("manual.continue")}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-s4 px-s4 pt-s4">
          <ManualCompletionBypassNotice />
          <ManualCompletionBody
            state={state}
            onLogCallAttempt={() => {
              void state.query.refetch();
            }}
          />
        </div>
      </MobileActionScreen>

      <OtpArrivedInterrupt
        isOpen={Boolean(context?.otpArrivedAtIso)}
        customerName={context?.booking.customerName ?? ""}
        verifiedAtIso={context?.otpArrivedAtIso ?? ""}
        onViewBooking={state.discard.confirmDiscard}
      />

      <StepUpChallenge
        stepUp={state.stepUp}
        tone="brand"
        title={t("manual.title")}
        summary={t("manual.stepUpSummary", { reference: context?.booking.reference ?? "" })}
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
