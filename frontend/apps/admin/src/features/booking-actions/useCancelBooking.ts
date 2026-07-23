import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { useAppForm } from "../../lib/forms/useAppForm";
import type { ApiError } from "../../lib/http/apiError";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { useStepUp } from "../../hooks/useStepUp";
import { useUndoableAction } from "../../hooks/useUndoableAction";
import { ROUTES } from "../../routes/routes.constants";
import { fetchCancelContext, submitCancel, undoAction } from "./booking-actions.api";
import {
  BOOKING_ACTION_QUERY_KEYS,
  CANCEL_REASON_CODES,
  NOTE_MAX_LENGTH,
  OTHER_REASON_NOTE_MIN_LENGTH,
  type CancelReasonCode,
} from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { CancelContext } from "./booking-actions.types";
import { useDiscardGuard } from "./useDiscardGuard";
import { useIdempotencyKey } from "./useIdempotencyKey";

const cancelSchema = z
  .object({
    reasonCode: z.string().min(1),
    note: z.string().max(NOTE_MAX_LENGTH),
    useCustomRefund: z.boolean(),
    customAmountRupees: z.number().min(0),
    waiveFee: z.boolean(),
    overrideJustification: z.string().max(NOTE_MAX_LENGTH),
  })
  .superRefine((values, ctx) => {
    if (
      values.reasonCode === CANCEL_REASON_CODES.otherNoteRequired &&
      values.note.trim().length < OTHER_REASON_NOTE_MIN_LENGTH
    ) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "note-required" });
    }
    // An override and its justification are one record in the audit log, so they are one gate here.
    if (values.useCustomRefund && values.overrideJustification.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["overrideJustification"],
        message: "override-required",
      });
    }
  });

export type CancelValues = z.infer<typeof cancelSchema>;

/** Emergency-only since D2 — the routine customer path never reaches here. */
export function useCancelBooking() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("adminBookingActions");
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.cancelBooking);
  const stepUp = useStepUp(ADMIN_ACTIONS.cancelBooking);
  const announce = useUndoableAction(ADMIN_ACTIONS.cancelBooking);
  const { idempotencyKey, rotate } = useIdempotencyKey();
  const [isDirty, setIsDirty] = useState(false);

  const query = useQuery<CancelContext>({
    queryKey: BOOKING_ACTION_QUERY_KEYS.cancel(bookingId),
    queryFn: ({ signal }) => fetchCancelContext(bookingId, signal),
    enabled: bookingId.length > 0,
  });

  const exit = useCallback(() => {
    void navigate(ROUTES.bookingDetail(bookingId));
  }, [navigate, bookingId]);

  const discard = useDiscardGuard(isDirty, exit);
  const mutation = useMutation({ mutationFn: submitCancel });

  const form = useAppForm<CancelValues>({
    schema: cancelSchema,
    defaultValues: {
      reasonCode: "",
      note: "",
      useCustomRefund: false,
      customAmountRupees: 0,
      waiveFee: false,
      overrideJustification: "",
    },
    onSubmit: async (values) => {
      // Fresh verification, not a confirm dialog — the hook owns the 60s window (spec §5.5).
      if (!(await stepUp.request())) return;

      const context = query.data;
      const version = context?.booking.version ?? 0;
      const key = idempotencyKey;

      await mutation.mutateAsync({
        bookingId,
        version,
        idempotencyKey,
        reasonCode: values.reasonCode as CancelReasonCode,
        note: values.note,
        refund: {
          amountPaise: values.useCustomRefund
            ? rupeesToPaise(values.customAmountRupees)
            : (context?.policyRefundPaise ?? 0),
          isPolicyAmount: !values.useCustomRefund,
          waiveFee: values.waiveFee,
          overrideJustification: values.overrideJustification,
        },
      });
      rotate();
      setIsDirty(false);
      // 10s of undo, read from the risk register. Undo is a compensating, separately audited call.
      announce({
        message: t("cancel.doneToast"),
        onUndo: () => {
          // The 10s window is server-enforced from the real event timestamps; losing that race
          // (or the network) must not fail silently — same danger-toast pattern as main.tsx's
          // mutation bridge. A failed refund reversal arrives here too ("That could not be undone.").
          undoAction({
            bookingId,
            version: version + 1,
            idempotencyKey: key,
            undoes: "cancel",
          }).catch((failure: ApiError) => {
            showToast({ message: failure.message, tone: TOAST_TONES.danger });
          });
        },
      });
      exit();
    },
  });

  return {
    bookingId,
    query,
    form,
    policy,
    decision,
    stepUp,
    discard,
    markDirty: () => setIsDirty(true),
    requestExit: discard.requestExit,
  };
}

export type CancelBookingState = ReturnType<typeof useCancelBooking>;
