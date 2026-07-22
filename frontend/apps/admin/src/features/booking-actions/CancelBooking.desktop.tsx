import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SkeletonList } from "../../components/ui/Skeleton";
import { CancelBookingForm } from "./CancelBookingForm";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { StepUpChallenge } from "./StepUpChallenge";
import { cancelSummaryLine } from "./cancelSummary";
import type { CancelBookingState } from "./useCancelBooking";

/**
 * BOX 26–28. Desktop keeps the booking record visible underneath so the ops manager can still read
 * WHO they are about to strand while they pick a reason — that is the whole argument for a modal
 * here rather than a route change. Header and footer are pinned; only the body scrolls, because a
 * destructive commit button that can scroll out of reach is how people cancel the wrong booking.
 */
export function CancelBookingDesktop({ state }: { state: CancelBookingState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;

  return (
    <>
      <Modal
        isOpen
        width="large"
        title={t("cancel.title")}
        {...(context ? { subtitle: context.booking.reference } : {})}
        isDismissable={!state.form.isSubmitting}
        onDismiss={state.requestExit}
        footer={
          <>
            <Button variant="text" size="section" onClick={state.requestExit}>
              {tShell("actions.cancel")}
            </Button>
            {/* Red, not brand blue: brand blue is the "proceed" colour everywhere else, and
                borrowing it here would let this screen be dismissed with save-muscle-memory. */}
            <Button
              variant="danger"
              size="section"
              isLoading={state.form.isSubmitting}
              onClick={() => void state.form.handleSubmit()}
            >
              {t("cancel.continueToConfirm")}
            </Button>
          </>
        }
      >
        <QueryBoundary
          query={state.query}
          skeleton={<SkeletonList rows={5} rowClassName="h-row-56" label={t("cancel.loading")} />}
        >
          {(data) => <CancelBookingForm context={data} state={state} />}
        </QueryBoundary>
      </Modal>

      <StepUpChallenge
        isOpen={state.stepUp.isChallenging}
        isDesktop
        tone="danger"
        title={t("cancel.confirmTitle")}
        summary={cancelSummaryLine(context ?? null, state.form.form.watch(), t)}
        confirmLabel={tShell("actions.confirm")}
        onConfirm={state.stepUp.confirm}
        onCancel={state.stepUp.cancel}
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
