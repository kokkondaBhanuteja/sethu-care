import { X } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Stepper } from "../../components/ui/StepRail";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { ActionBar } from "../../layouts/ActionBar";
import { DiscardChangesDialog } from "./components/DiscardChangesDialog";
import { MobileScroll } from "../../layouts/PageMain";
import { RatingValue } from "./components/Rating";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { SuspendActionTypes } from "./components/SuspendActionTypes";
import { SuspendImpactCard } from "./components/SuspendImpactCard";
import { SuspendReasonFields } from "./components/SuspendReasonFields";
import { SuspendStepConfirm } from "./components/SuspendStepConfirm";
import { SuspendStepJobs } from "./components/SuspendStepJobs";
import { TOTAL_STEPS, useSuspendProviderFlow } from "./hooks/useSuspendProviderFlow";

/** M60–M62. A full-screen flow, drawn in danger red, with the stepper under the app bar. */
export function SuspendProviderMobile() {
  const { t } = useTranslation("adminProviders");
  const flow = useSuspendProviderFlow();
  const isLastPane = flow.paneIndex === 2;

  return (
    <>
      <MobileAppBar
        title={t("suspend.title")}
        compact
        showBack
        onBack={flow.requestClose}
        actions={
          <>
            <span className="text-label text-text-2">
              {t("suspend.stepCounter", { current: flow.stepNumber, total: TOTAL_STEPS })}
            </span>
            <Button
              variant="text"
              size="inline"
              aria-label={t("suspend.close")}
              onClick={flow.requestClose}
            >
              <Icon glyph={X} size="xl" />
            </Button>
          </>
        }
      />

      <div className="flex-none px-s4 pb-s3">
        <Stepper
          label={t("suspend.stepperLabel")}
          count={TOTAL_STEPS}
          activeIndex={flow.railIndex}
          tone="danger"
        />
      </div>

      {flow.profile ? (
        <div className="flex flex-none items-center gap-s2 bg-surface px-s4 py-s3">
          {/* The name is printed beside it — a hearing avatar would announce it twice. */}
          <span aria-hidden>
            <Avatar name={flow.profile.name} size="sm" />
          </span>
          <span className="text-label text-text-1">
            {flow.profile.name} · <span className="font-mono">{flow.profile.id}</span> ·{" "}
            <RatingValue value={flow.profile.rating} tight />
          </span>
        </div>
      ) : null}

      <MobileScroll>
        {flow.paneIndex === 0 ? (
          <div className="flex flex-col gap-s5 px-s4 py-s4">
            <SuspendImpactCard />

            <div>
              <h2 className="text-card text-text-1">{t("suspend.actionQuestion")}</h2>
              <div className="mt-s3">
                <SuspendActionTypes
                  layout="stack"
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
          <div className="px-s4 py-s4">
            <SuspendStepJobs flow={flow} layout="stack" />
          </div>
        ) : null}

        {flow.paneIndex === 2 ? (
          <div className="px-s4 py-s4">
            <SuspendStepConfirm flow={flow} />
          </div>
        ) : null}

        <div aria-hidden className="h-s4" />
      </MobileScroll>

      <ActionBar
        noteAbove
        note={
          flow.paneIndex === 1 && flow.unresolvedCount > 0
            ? t("suspend.jobsRemaining", { count: flow.unresolvedCount })
            : undefined
        }
      >
        <Button
          variant="danger"
          size="primary"
          block
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
      </ActionBar>

      <StepUpChallenge stepUp={flow.stepUp} />
      <DiscardChangesDialog
        isOpen={flow.isDiscardPrompted}
        onKeepEditing={flow.keepEditing}
        onDiscard={flow.discard}
      />
    </>
  );
}
