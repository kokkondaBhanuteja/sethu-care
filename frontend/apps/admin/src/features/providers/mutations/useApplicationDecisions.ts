import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, apiError, normalizeError } from "../../../lib/http/apiError";
import { ADMIN_ACTIONS } from "../../../lib/permissions/actions";
import { useActionPolicy, useCan } from "../../../lib/permissions/usePermission";
import { useStepUp } from "../../../hooks/useStepUp";
import { useUndoableAction } from "../../../hooks/useUndoableAction";
import { showToast, TOAST_TONES } from "../../../lib/toast/toastStore";
import {
  approveApplication,
  rejectApplication,
  requestApplicationDocuments,
} from "../applications.api";
import { outstandingDocumentKeys } from "../providers.api.requests";
import { PROVIDER_QUERY_KEYS } from "../providers.constants";
import type { ApplicationReview, RejectApplicationInput } from "../applications.types";

const APPLICATIONS_QUERY_SCOPE = ["providers", "applications"] as const;

/**
 * Approve (medium risk, 30s undo), reject (critical, step-up, reason code, no undo) and
 * request-documents (low risk) — every one of those facts read from the action registry.
 *
 * The loaded review rides in because every decision now sends its CAS `version` (and
 * request-documents derives WHAT is owed from the record); the buttons only render once the
 * record is loaded, so the null guards are belt-and-braces.
 */
export function useApplicationDecisions(
  applicationId: string,
  review: ApplicationReview | null,
  onDecided: () => void,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("adminProviders");

  const canApprove = useCan(ADMIN_ACTIONS.approveApplication);
  const canReject = useCan(ADMIN_ACTIONS.rejectApplication);
  const canRequestDocuments = useCan(ADMIN_ACTIONS.requestDocuments);
  const { policy: rejectPolicy } = useActionPolicy(ADMIN_ACTIONS.rejectApplication);
  const rejectStepUp = useStepUp(ADMIN_ACTIONS.rejectApplication);
  const announceApproval = useUndoableAction(ADMIN_ACTIONS.approveApplication);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: PROVIDER_QUERY_KEYS.application(applicationId),
    });
    void queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_SCOPE });
  }

  /**
   * A conflict is a designed outcome, not a dead end: ALREADY_DECIDED re-reads into the
   * informational banner (M74) and VERSION_CONFLICT re-reads to the latest record. A 422 on
   * approve also re-reads — the server recomputed the blockers, and they render over the button.
   */
  function reReadOnConflict(thrown: unknown) {
    const error = normalizeError(thrown, t("review.permissionDenied"));
    if (error.code === API_ERROR_CODES.conflict || error.code === API_ERROR_CODES.validation) {
      invalidate();
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (version: number) => {
      if (!canApprove) {
        throw apiError(API_ERROR_CODES.forbidden, t("review.permissionDenied"), { status: 403 });
      }
      return approveApplication({ applicationId, version });
    },
    onSuccess: (result) => {
      invalidate();
      announceApproval({
        message: t("review.approved", { name: result.applicantName }),
        onUndo: () => {
          showToast({ message: t("review.approveUndone"), tone: TOAST_TONES.info });
          invalidate();
        },
      });
      onDecided();
    },
    onError: reReadOnConflict,
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: RejectApplicationInput) => {
      if (!canReject) {
        throw apiError(API_ERROR_CODES.forbidden, t("review.permissionDenied"), { status: 403 });
      }
      return rejectApplication(input);
    },
    onSuccess: (result) => {
      invalidate();
      // No undo window: the applicant is notified by SMS the moment this lands (spec §6.18).
      showToast({
        message: t("review.rejected", { name: result.applicantName }),
        tone: TOAST_TONES.success,
      });
      onDecided();
    },
    onError: reReadOnConflict,
  });

  const requestDocumentsMutation = useMutation({
    mutationFn: async (loaded: ApplicationReview) => {
      if (!canRequestDocuments) {
        throw apiError(API_ERROR_CODES.forbidden, t("review.permissionDenied"), { status: 403 });
      }
      return requestApplicationDocuments({
        applicationId,
        version: loaded.version,
        applicantName: loaded.applicantName,
        documentTypeKeys: outstandingDocumentKeys(loaded),
      });
    },
    onSuccess: (result) => {
      invalidate();
      showToast({
        message: t("review.documentsRequested", { name: result.applicantName }),
        tone: TOAST_TONES.success,
      });
    },
    onError: reReadOnConflict,
  });

  /** Rethrows the ApiError so the review hook can land field errors on the reject form. */
  const reject = useCallback(
    async (input: RejectApplicationInput) => {
      if (!canReject) return;
      const isVerified = await rejectStepUp.request();
      if (!isVerified) return;
      await rejectMutation.mutateAsync(input);
    },
    [canReject, rejectStepUp, rejectMutation],
  );

  return {
    canApprove,
    canReject,
    canRequestDocuments,
    rejectPolicy,
    rejectStepUp,
    approve: () => {
      if (review === null) return;
      approveMutation.mutate(review.version);
    },
    isApproving: approveMutation.isPending,
    reject,
    isRejecting: rejectMutation.isPending,
    requestDocuments: () => {
      if (review === null) return;
      requestDocumentsMutation.mutate(review);
    },
    isRequestingDocuments: requestDocumentsMutation.isPending,
  };
}
