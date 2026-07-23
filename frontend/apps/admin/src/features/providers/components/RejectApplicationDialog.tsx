import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { formatDate } from "../../../lib/format";
import type { ApplicationReview, RejectReasonCode } from "../applications.types";
import {
  isRejectDraftComplete,
  RejectApplicationForm,
  type RejectDraft,
} from "./RejectApplicationForm";

const EMPTY_DRAFT: RejectDraft = { reasonCode: null, note: "" };

export interface RejectApplicationDialogProps {
  isOpen: boolean;
  review: ApplicationReview;
  isSubmitting: boolean;
  requiresStepUp: boolean;
  /** The server's 422 on the note, landed on its field while the dialog stays open. */
  noteError?: string | null;
  onCancel: () => void;
  onSubmit: (input: { reasonCode: RejectReasonCode; note: string }) => void;
}

/**
 * BOX 46 / M72. Desktop shows it as a modal over an unchanged page; mobile gets the whole screen,
 * because rejecting an application ends somebody's application to earn a living and the flow
 * deserves more than a half-height overlay a thumb can dismiss by accident.
 */
export function RejectApplicationDialog({
  isOpen,
  review,
  isSubmitting,
  requiresStepUp,
  noteError,
  onCancel,
  onSubmit,
}: RejectApplicationDialogProps) {
  const { t } = useTranslation("adminProviders");
  const { t: tShell } = useTranslation("adminShell");
  const [draft, setDraft] = useState<RejectDraft>(EMPTY_DRAFT);

  function handleSubmit() {
    if (draft.reasonCode === null || !isRejectDraftComplete(draft)) return;
    onSubmit({ reasonCode: draft.reasonCode, note: draft.note.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t("review.rejectTitle")}
      subtitle={t("review.rejectSubtitle", {
        name: review.applicantName,
        date: formatDate(review.appliedAt),
      })}
      width="medium"
      onDismiss={onCancel}
      isDismissable={!isSubmitting}
      footer={
        <>
          <span className="mr-auto text-caption text-text-3">{t("review.rejectFinalNote")}</span>
          <Button variant="text" onClick={onCancel}>
            {tShell("actions.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={!isRejectDraftComplete(draft)}
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {/* Named commit: a bare "Confirm" on an irreversible action hides what it does. */}
            {requiresStepUp ? t("review.rejectConfirmBiometric") : t("review.rejectConfirm")}
          </Button>
        </>
      }
    >
      <RejectApplicationForm draft={draft} onChange={setDraft} serverNoteError={noteError} />
    </Modal>
  );
}
