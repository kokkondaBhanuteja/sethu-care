import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { normalizeError } from "../../../lib/http/apiError";
import { ROUTES } from "../../../routes/routes.constants";
import { useApplicationDecisions } from "../mutations/useApplicationDecisions";
import { useApplicationReviewQuery } from "../queries/applications.queries";
import { DOCUMENT_VALIDATIONS } from "../applications.types";
import type { ApplicationDocument, RejectApplicationInput } from "../applications.types";

/**
 * Everything the review screens share. The approval gate is deliberately NOT computed here from
 * the document list: the server owns it (spec §6.18) and sends `approvalBlockers`, which this
 * mirrors so the reason can sit next to the dead control (BOX 47 / M73).
 */
export function useApplicationReview() {
  const { applicationId = "" } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const query = useApplicationReviewQuery(applicationId);
  const review = query.data ?? null;

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  /** A server-declared field error on the rejection note (422), rendered ON the field. */
  const [rejectNoteError, setRejectNoteError] = useState<string | null>(null);

  const decisions = useApplicationDecisions(applicationId, review, () => {
    void navigate(ROUTES.applications);
  });

  const documents = useMemo(() => review?.documents ?? [], [review]);
  const selectedDocument: ApplicationDocument | null = useMemo(() => {
    if (documents.length === 0) return null;
    const explicit = documents.find((document) => document.id === selectedDocumentId);
    if (explicit) return explicit;
    // Default to the document that failed: it is the one the decision actually turns on.
    return (
      documents.find((document) => document.validation === DOCUMENT_VALIDATIONS.failed) ??
      documents[0] ??
      null
    );
  }, [documents, selectedDocumentId]);

  const hasFailedValidation = documents.some(
    (document) => document.validation !== DOCUMENT_VALIDATIONS.validated,
  );

  const isDecided = review?.decision !== undefined;
  const blockers = review?.approvalBlockers ?? [];
  const canApproveNow = decisions.canApprove && blockers.length === 0 && !isDecided;

  const submitRejection = useCallback(
    async (input: Omit<RejectApplicationInput, "applicationId" | "version">) => {
      if (!review) return;
      try {
        await decisions.reject({ ...input, applicationId, version: review.version });
        setRejectNoteError(null);
        setIsRejecting(false);
      } catch (thrown) {
        // The toast bridge already announced the failure; what belongs to THIS screen is the
        // field placement — a 422 note error lands on the note control and the dialog stays open.
        const error = normalizeError(thrown, "");
        setRejectNoteError(error.fieldErrors?.note ?? null);
      }
    },
    [review, decisions, applicationId],
  );

  const closeReject = useCallback(() => {
    setRejectNoteError(null);
    setIsRejecting(false);
  }, []);

  return {
    applicationId,
    query,
    review,
    documents,
    selectedDocument,
    selectDocument: setSelectedDocumentId,
    hasFailedValidation,
    isDecided,
    blockers,
    canApproveNow,
    decisions,
    isRejecting,
    rejectNoteError,
    openReject: () => setIsRejecting(true),
    closeReject,
    submitRejection,
  };
}
