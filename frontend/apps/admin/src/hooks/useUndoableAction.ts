import { useCallback } from "react";
import { useTranslation } from "@sethu/i18n";

import { policyFor, type AdminAction } from "../lib/permissions/actions";
import { showToast, TOAST_TONES } from "../lib/toast/toastStore";

export interface UndoableActionOptions {
  /** Confirmation copy, e.g. "Booking cancelled". */
  message: string;
  /** Reverses the action. Only called if the operator hits Undo inside the window. */
  onUndo: () => void;
}

/**
 * Announces a completed action and offers Undo for exactly as long as the risk register allows —
 * 10s for cancel, suspend and block; 30s for assign and approve (spec §10.3).
 *
 * Actions with no undo window (refund, manual completion) get a plain confirmation: both have
 * immediate outside-world effects — a gateway call, a customer notification, payout eligibility —
 * and are corrected by a compensating, itself-audited action rather than silently reversed.
 */
export function useUndoableAction(action: AdminAction) {
  const { t } = useTranslation("adminShell");
  const undoWindowMs = policyFor(action).undoWindowMs;

  return useCallback(
    ({ message, onUndo }: UndoableActionOptions) => {
      if (undoWindowMs === null) {
        showToast({ message, tone: TOAST_TONES.success });
        return;
      }

      showToast({
        message,
        tone: TOAST_TONES.success,
        durationMs: undoWindowMs,
        showProgress: true,
        action: { label: t("actions.undo"), onAction: onUndo },
      });
    },
    [undoWindowMs, t],
  );
}
