import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, apiError } from "../../../lib/http/apiError";
import { ADMIN_ACTIONS } from "../../../lib/permissions/actions";
import { useActionPolicy, useCan } from "../../../lib/permissions/usePermission";
import { useStepUp } from "../../../hooks/useStepUp";
import { useUndoableAction } from "../../../hooks/useUndoableAction";
import { showToast, TOAST_TONES } from "../../../lib/toast/toastStore";
import {
  approveApplication,
  rejectApplication,
  requestApplicationDocuments,
} from "../providers.api";
import { PROVIDER_QUERY_KEYS } from "../providers.constants";
import type { RejectApplicationInput } from "../applications.types";

const APPLICATIONS_QUERY_SCOPE = ["providers", "applications"] as const;

/**
 * Approve (medium risk, 30s undo), reject (critical, step-up, reason code, no undo) and
 * request-documents (low risk) — every one of those facts read from the action registry.
 */
export function useApplicationDecisions(applicationId: string, onDecided: () => void) {
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

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!canApprove) {
        throw apiError(API_ERROR_CODES.forbidden, t("review.permissionDenied"), { status: 403 });
      }
      return approveApplication(applicationId);
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
  });

  const requestDocumentsMutation = useMutation({
    mutationFn: async () => {
      if (!canRequestDocuments) {
        throw apiError(API_ERROR_CODES.forbidden, t("review.permissionDenied"), { status: 403 });
      }
      return requestApplicationDocuments(applicationId);
    },
    onSuccess: (result) => {
      invalidate();
      showToast({
        message: t("review.documentsRequested", { name: result.applicantName }),
        tone: TOAST_TONES.success,
      });
    },
  });

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
      approveMutation.mutate();
    },
    isApproving: approveMutation.isPending,
    reject,
    isRejecting: rejectMutation.isPending,
    requestDocuments: () => {
      requestDocumentsMutation.mutate();
    },
    isRequestingDocuments: requestDocumentsMutation.isPending,
  };
}
