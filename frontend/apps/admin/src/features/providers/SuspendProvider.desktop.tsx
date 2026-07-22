import { IndianRupee } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { StepRail } from "../../components/ui/StepRail";
import { DiscardChangesDialog } from "./components/DiscardChangesDialog";
import { StepUpChallenge } from "./components/StepUpChallenge";
import { SuspendActionTypes } from "./components/SuspendActionTypes";
import { SuspendReasonFields } from "./components/SuspendReasonFields";
import { SuspendStepConfirm } from "./components/SuspendStepConfirm";
import { SuspendStepJobs } from "./components/SuspendStepJobs";
import { RatingValue } from "./components/Rating";
import { useSuspendProviderFlow, TOTAL_STEPS } from "./hooks/useSuspendProviderFlow";
import { useSuspendSteps } from "./hooks/useSuspendSteps";

/**
 * BOX 36–38. A centred modal with the four-step rail, drawn in danger red rather than brand blue
 * so it is never mistaken for the manual-completion flow it otherwise resembles.
 */
export function SuspendProviderDesktop() {
  const { t } = useTranslation("adminProviders");
  const { t: tShell } = useTranslation("adminShell");
  const flow = useSuspendProviderFlow();
  const steps = useSuspendSteps();
  const isLastPane = flow.paneIndex === 2;

  return (
    <>
      <Modal
        isOpen
        title={t("suspend.title")}
        subtitle={t("suspend.stepCounter", { current: flow.stepNumber, total: TOTAL_STEPS })}
        onDismiss={flow.requestClose}
        isDismissable={!flow.isSubmitting}
        rail={
          <StepRail
            label={t("suspend.railLabel")}
            steps={steps}
            activeIndex={flow.railIndex}
            tone="danger"
            footer={
              flow.profile ? (
                <div className="flex items-center gap-s2">
                  <Avatar name={flow.profile.name} size="lg" />
                  <span className="grow min-w-0">
                    <span className="block truncate text-label font-semibold text-text-1">
                      {flow.profile.name}
                    </span>
                    <span className="block text-caption text-text-3">
                      <span className="font-mono">{flow.profile.id}</span> ·{" "}
                      <RatingValue value={flow.profile.rating} tight />
                    </span>
                  </span>
                </div>
              ) : null
            }
          />
        }
        footer={
          <>
            <Button variant="text" onClick={flow.paneIndex === 0 ? flow.requestClose : flow.goBack}>
              {flow.paneIndex === 0 ? tShell("actions.cancel") : tShell("actions.back")}
            </Button>
            {flow.paneIndex === 1 && flow.unresolvedCount > 0 ? (
              <span className="text-caption text-danger">
                {t("suspend.jobsRemaining", { count: flow.unresolvedCount })}
              </span>
            ) : null}
            <Button
              variant="danger"
              disabled={!flow.canContinue || !flow.canAct}
              isLoading={flow.isSubmitting}
              onClick={isLastPane ? flow.submit : flow.goNext}
            >
              {isLastPane
                ? flow.policy.requiresStepUp
                  ? t("suspend.confirmBiometric")
                  : t("suspend.confirmPlain")
                : t("suspend.continue")}
            </Button>
          </>
        }
      >
        {/* Pinned: the cost of this action must be readable at every step, not only where it is named. */}
        <Banner tone="danger" icon={IndianRupee} title={t("suspend.impactTitle")} />

        {flow.paneIndex === 0 ? (
          <div className="mt-s4 flex flex-col gap-s5">
            <div>
              <h2 className="text-section text-text-1">{t("suspend.actionQuestion")}</h2>
              <div className="mt-s3">
                <SuspendActionTypes
                  layout="row"
                  value={flow.type}
                  onValueChange={flow.setType}
                  durationDays={flow.durationDays}
                  onDurationChange={flow.setDurationDays}
                />
              </div>
            </div>
            <SuspendReasonFields
              reasonCode={flow.reasonCode}
              onReasonChange={flow.setReasonCode}
              note={flow.note}
              onNoteChange={flow.setNote}
            />
          </div>
        ) : null}

        {flow.paneIndex === 1 ? (
          <div className="mt-s4">
            <SuspendStepJobs flow={flow} layout="row" />
          </div>
        ) : null}

        {flow.paneIndex === 2 ? (
          <div className="mt-s4">
            <SuspendStepConfirm flow={flow} />
          </div>
        ) : null}
      </Modal>

      <StepUpChallenge stepUp={flow.stepUp} />
      <DiscardChangesDialog
        isOpen={flow.isDiscardPrompted}
        onKeepEditing={flow.keepEditing}
        onDiscard={flow.discard}
      />
    </>
  );
}
