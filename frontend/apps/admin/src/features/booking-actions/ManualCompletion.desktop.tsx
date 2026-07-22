import { Fingerprint } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { StepRail } from "../../components/ui/StepRail";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { ManualCompletionBody } from "./ManualCompletionBody";
import {
  ManualCompletionBypassNotice,
  ManualCompletionTooEarly,
  OtpArrivedInterrupt,
} from "./ManualCompletionNotices";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { MANUAL_COMPLETION_STEP_IDS } from "./booking-actions.constants";
import { canLeaveStep } from "./manualCompletionGates";
import type { ManualCompletionState } from "./useManualCompletion";

/**
 * BOX 31–35. Desktop has room for a rail that NAMES every step, so the operator can see that an
 * attestation and a confirm still stand between them and the commit — the deterrent is the
 * itinerary, not the fraction.
 */
export function ManualCompletionDesktop({ state }: { state: ManualCompletionState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;
  const canContinue = canLeaveStep(state.stepIndex, state.form.form.watch(), state.gaps);
  const hasOtpArrived = Boolean(context?.otpArrivedAtIso);

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
      <Modal
        isOpen
        title={t("manual.title")}
        isDismissable={!state.form.isSubmitting && !state.discard.isPrompting && !hasOtpArrived}
        onDismiss={state.requestExit}
        rail={
          <StepRail
            label={t("manual.stepsLabel")}
            activeIndex={state.stepIndex}
            steps={MANUAL_COMPLETION_STEP_IDS.map((stepId, index) => ({
              id: stepId,
              label: t(`manual.step.${stepId}`, { index: index + 1 }),
            }))}
            footer={
              context ? (
                <span className="text-caption text-text-2">
                  {t("manual.railContext", {
                    reference: context.booking.reference,
                    service: context.booking.serviceName,
                    provider: context.providerName,
                    minutes: context.minutesSinceWorkReported,
                  })}
                </span>
              ) : undefined
            }
          />
        }
        footer={
          <>
            <Button
              variant="text"
              size="section"
              onClick={state.stepIndex === 0 ? state.requestExit : state.goBack}
            >
              {state.stepIndex === 0 ? tShell("actions.cancel") : tShell("actions.back")}
            </Button>
            <span className="flex-1 text-center text-caption text-text-3">
              {state.stepIndex === 1 && !state.gaps.isSatisfied
                ? t("manual.evidenceBlockedNote")
                : null}
            </span>
            {state.isLastStep ? (
              <Button
                variant="primary"
                size="section"
                iconStart={Fingerprint}
                isLoading={state.form.isSubmitting}
                onClick={() => void state.form.handleSubmit()}
              >
                {t("shared.confirmWithBiometrics")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="section"
                disabled={!canContinue}
                onClick={state.goNext}
              >
                {t("manual.continue")}
              </Button>
            )}
          </>
        }
      >
        <ManualCompletionBypassNotice />
        <ManualCompletionBody
          state={state}
          isDesktop
          onLogCallAttempt={() => {
            // The call itself is placed by the OS dialler; the log arrives from the server, which
            // is the only party that can vouch for it.
            void state.query.refetch();
          }}
        />
      </Modal>

      <OtpArrivedInterrupt
        isOpen={hasOtpArrived}
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
        isDesktop
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
