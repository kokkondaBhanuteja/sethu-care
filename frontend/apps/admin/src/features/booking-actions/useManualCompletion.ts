import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { useAppForm } from "../../lib/forms/useAppForm";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { useStepUp } from "../../hooks/useStepUp";
import { useUndoableAction } from "../../hooks/useUndoableAction";
import { ROUTES } from "../../routes/routes.constants";
import { fetchManualCompletionContext, submitManualCompletion } from "./booking-actions.api";
import {
  BOOKING_ACTION_QUERY_KEYS,
  MANUAL_COMPLETION_NOTE_MIN_LENGTH,
  MANUAL_COMPLETION_STEP_IDS,
  NOTE_MAX_LENGTH,
  type ManualCompletionReasonCode,
} from "./booking-actions.constants";
import { evidenceGaps } from "./manualCompletionGates";
import type { ManualCompletionContext } from "./booking-actions.types";
import { useDiscardGuard } from "./useDiscardGuard";
import { useIdempotencyKey } from "./useIdempotencyKey";

const manualCompletionSchema = z.object({
  reasonCode: z.string().min(1),
  note: z.string().min(MANUAL_COMPLETION_NOTE_MIN_LENGTH).max(NOTE_MAX_LENGTH),
  spokeToProvider: z.literal(true),
  attemptedCustomer: z.literal(true),
  believesWorkDone: z.literal(true),
});

export type ManualCompletionValues = z.infer<typeof manualCompletionSchema>;

const LAST_STEP = MANUAL_COMPLETION_STEP_IDS.length - 1;

/**
 * The deliberately effortful alternative to an OTP override (spec §1.6). Four named steps, one
 * decision each, and no route to the confirm step that skips evidence or attestation.
 *
 * The 30-minute lock and the evidence gates mirrored here are SERVER-enforced — the client mirrors
 * them so the flow reads honestly, and the server rejects anything that slips past (spec §6.14).
 */
export function useManualCompletion() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("adminBookingActions");
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.manualComplete);
  const stepUp = useStepUp(ADMIN_ACTIONS.manualComplete);
  const announce = useUndoableAction(ADMIN_ACTIONS.manualComplete);
  const { idempotencyKey, rotate } = useIdempotencyKey();
  const [stepIndex, setStepIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const query = useQuery<ManualCompletionContext>({
    queryKey: BOOKING_ACTION_QUERY_KEYS.manualCompletion(bookingId),
    queryFn: ({ signal }) => fetchManualCompletionContext(bookingId, signal),
    enabled: bookingId.length > 0,
  });

  const exit = useCallback(() => {
    void navigate(ROUTES.bookingDetail(bookingId));
  }, [navigate, bookingId]);

  const discard = useDiscardGuard(isDirty, exit);
  const mutation = useMutation({ mutationFn: submitManualCompletion });

  const form = useAppForm<ManualCompletionValues>({
    schema: manualCompletionSchema,
    // Attestations start UNCHECKED. Spec §6.14 step 3 draws them empty, and an attestation the
    // operator did not make is not an attestation — their name goes on this in the audit log.
    defaultValues: {
      reasonCode: "",
      note: "",
      spokeToProvider: false as true,
      attemptedCustomer: false as true,
      believesWorkDone: false as true,
    },
    onSubmit: async (values) => {
      if (!(await stepUp.request())) return;
      const context = query.data;

      await mutation.mutateAsync({
        bookingId,
        version: context?.booking.version ?? 0,
        idempotencyKey,
        reasonCode: values.reasonCode as ManualCompletionReasonCode,
        note: values.note,
        evidence: {
          workPhotoIds: context?.evidence.workPhotoIds ?? [],
          callAttemptIds: (context?.evidence.callAttempts ?? []).map((attempt) => attempt.id),
          completionReportId: context?.evidence.completionReportId ?? null,
        },
        attestations: {
          spokeToProvider: values.spokeToProvider,
          attemptedCustomer: values.attemptedCustomer,
          believesWorkDone: values.believesWorkDone,
        },
      });
      rotate();
      setIsDirty(false);
      // No undo, on purpose: the customer is notified and payout eligibility is released the moment
      // this lands. It is corrected by a compensating, itself-audited action (spec §5.5).
      announce({ message: t("manual.doneToast"), onUndo: () => setIsDirty(false) });
      exit();
    },
  });

  const gaps = useMemo(() => evidenceGaps(query.data ?? null), [query.data]);

  const goNext = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, LAST_STEP));
  }, []);
  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  return {
    bookingId,
    query,
    form,
    policy,
    decision,
    stepUp,
    discard,
    stepIndex,
    isLastStep: stepIndex === LAST_STEP,
    goNext,
    goBack,
    gaps,
    markDirty: () => setIsDirty(true),
    requestExit: discard.requestExit,
  };
}

export type ManualCompletionState = ReturnType<typeof useManualCompletion>;
