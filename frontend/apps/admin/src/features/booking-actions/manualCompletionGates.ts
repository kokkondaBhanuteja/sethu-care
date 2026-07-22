import {
  MANUAL_COMPLETION_NOTE_MIN_LENGTH,
  MANUAL_COMPLETION_REASON_CODES,
  OTHER_REASON_NOTE_MIN_LENGTH,
} from "./booking-actions.constants";
import type { ManualCompletionContext } from "./booking-actions.types";
import type { ManualCompletionValues } from "./useManualCompletion";

export interface EvidenceGaps {
  readonly needsPhotos: boolean;
  readonly needsReport: boolean;
  readonly needsCallAttempt: boolean;
  readonly isSatisfied: boolean;
}

/**
 * The evidence gates from spec §6.14, mirrored for a good experience only. The server enforces them
 * and returns `422 EVIDENCE_INSUFFICIENT` naming the missing item; nothing here decides anything.
 */
export function evidenceGaps(context: ManualCompletionContext | null): EvidenceGaps {
  const needsPhotos = (context?.evidence.workPhotoIds.length ?? 0) === 0;
  const needsReport = (context?.evidence.completionReportId ?? null) === null;
  const needsCallAttempt = (context?.evidence.callAttempts.length ?? 0) === 0;

  return {
    needsPhotos,
    needsReport,
    needsCallAttempt,
    isSatisfied: !needsPhotos && !needsReport && !needsCallAttempt,
  };
}

/** Whether the operator may leave the step they are on. Each step gates exactly one decision. */
export function canLeaveStep(
  stepIndex: number,
  values: ManualCompletionValues,
  gaps: EvidenceGaps,
): boolean {
  if (stepIndex === 0) {
    if (values.reasonCode.length === 0) return false;
    if (values.reasonCode === MANUAL_COMPLETION_REASON_CODES.otherNoteRequired) {
      return values.note.trim().length >= OTHER_REASON_NOTE_MIN_LENGTH;
    }
    return true;
  }

  if (stepIndex === 1) return gaps.isSatisfied;

  if (stepIndex === 2) {
    return (
      values.spokeToProvider &&
      values.attemptedCustomer &&
      values.believesWorkDone &&
      values.note.trim().length >= MANUAL_COMPLETION_NOTE_MIN_LENGTH
    );
  }

  return true;
}
