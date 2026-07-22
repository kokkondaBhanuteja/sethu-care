import { useCallback, useEffect, useState } from "react";
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
import { fetchRefundContext, submitRefund } from "./booking-actions.api";
import {
  BOOKING_ACTION_QUERY_KEYS,
  NOTE_MAX_LENGTH,
  PROVIDER_AT_FAULT_REASONS,
  REFUND_PAYOUT_IMPACTS,
  REFUND_TYPES,
  type RefundPayoutImpact,
  type RefundReasonCode,
  type RefundTypeId,
} from "./booking-actions.constants";
import { paiseToRupeeInput, rupeesToPaise } from "./booking-actions.money";
import type { RefundContext } from "./booking-actions.types";
import { useDiscardGuard } from "./useDiscardGuard";
import { useIdempotencyKey } from "./useIdempotencyKey";

const refundSchema = z.object({
  refundType: z.string().min(1),
  amountRupees: z.number().min(1),
  reasonCode: z.string().min(1),
  note: z.string().max(NOTE_MAX_LENGTH),
  payoutImpact: z.string().min(1),
});

export type RefundValues = z.infer<typeof refundSchema>;

/** Refund has no undo window in the risk register, so this handler cannot run. */
const NEVER_CALLED = () => undefined;

/**
 * The one finance action permitted on mobile (spec §1.5's money boundary): a single bounded amount
 * tied to one booking, resolving a live customer conversation. Payout runs stay on desktop.
 */
export function useRefund() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("adminBookingActions");
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.refund);
  const stepUp = useStepUp(ADMIN_ACTIONS.refund);
  const announce = useUndoableAction(ADMIN_ACTIONS.refund);
  const { idempotencyKey, rotate } = useIdempotencyKey();
  const [isDirty, setIsDirty] = useState(false);

  const query = useQuery<RefundContext>({
    queryKey: BOOKING_ACTION_QUERY_KEYS.refund(bookingId),
    queryFn: ({ signal }) => fetchRefundContext(bookingId, signal),
    enabled: bookingId.length > 0,
  });

  const exit = useCallback(() => {
    void navigate(ROUTES.bookingDetail(bookingId));
  }, [navigate, bookingId]);

  const discard = useDiscardGuard(isDirty, exit);
  const mutation = useMutation({ mutationFn: submitRefund });

  const form = useAppForm<RefundValues>({
    schema: refundSchema,
    // payoutImpact starts UNSET: "withhold" before any reason exists would penalise the provider
    // by default. Choosing a reason applies the recommended impact (selectReason), still editable.
    defaultValues: {
      refundType: REFUND_TYPES.full,
      amountRupees: 0,
      reasonCode: "",
      note: "",
      payoutImpact: "",
    },
    onSubmit: async (values) => {
      if (!(await stepUp.request())) return;

      const receipt = await mutation.mutateAsync({
        bookingId,
        version: query.data?.booking.version ?? 0,
        idempotencyKey,
        refundType: values.refundType as RefundTypeId,
        amountPaise: rupeesToPaise(values.amountRupees),
        reasonCode: values.reasonCode as RefundReasonCode,
        note: values.note,
        payoutImpact: values.payoutImpact as RefundPayoutImpact,
      });
      rotate();
      setIsDirty(false);
      // Never reported as done when the gateway went quiet: the operator must not tell a customer
      // money is on its way when it is not (spec §6.27). And no undo window in the registry — the
      // call has already left the building — so no Undo affordance is drawn.
      announce({
        message: receipt.isPending ? t("refund.pendingToast") : t("refund.doneToast"),
        onUndo: NEVER_CALLED,
      });
      exit();
    },
  });

  const { form: refundForm } = form;
  const refundablePaise = query.data?.refundablePaise;

  // Pre-fill per type (spec §6.27 step 2). A blank amount field on a money screen invites a typo;
  // the full refundable balance is the correct starting point for every type except a partial.
  useEffect(() => {
    if (refundablePaise === undefined) return;
    refundForm.setValue("amountRupees", paiseToRupeeInput(refundablePaise));
  }, [refundablePaise, refundForm]);

  /** The payout default FOLLOWS the reason — it is a consequence, not a separate decision. */
  const selectReason = useCallback(
    (code: RefundReasonCode) => {
      form.form.setValue("reasonCode", code);
      form.form.setValue(
        "payoutImpact",
        PROVIDER_AT_FAULT_REASONS.has(code)
          ? REFUND_PAYOUT_IMPACTS.withhold
          : REFUND_PAYOUT_IMPACTS.payAnyway,
      );
      setIsDirty(true);
    },
    [form.form],
  );

  return {
    bookingId,
    query,
    form,
    policy,
    decision,
    stepUp,
    discard,
    selectReason,
    markDirty: () => setIsDirty(true),
    requestExit: discard.requestExit,
  };
}

export type RefundState = ReturnType<typeof useRefund>;
