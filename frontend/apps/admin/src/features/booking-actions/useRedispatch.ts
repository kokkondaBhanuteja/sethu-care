import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { useAppForm } from "../../lib/forms/useAppForm";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { useUndoableAction } from "../../hooks/useUndoableAction";
import { ROUTES } from "../../routes/routes.constants";
import { fetchRedispatchContext, submitRedispatch } from "./booking-actions.api";
import {
  BOOKING_ACTION_QUERY_KEYS,
  REDISPATCH_RADII,
  type RedispatchRadiusId,
} from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { RedispatchContext } from "./booking-actions.types";
import { useDiscardGuard } from "./useDiscardGuard";
import { useIdempotencyKey } from "./useIdempotencyKey";

const redispatchSchema = z.object({
  radiusId: z.enum([
    REDISPATCH_RADII.base,
    REDISPATCH_RADII.plus50,
    REDISPATCH_RADII.plus100,
    REDISPATCH_RADII.cityWide,
  ]),
  relaxSkillMatch: z.boolean(),
  includeDecliners: z.boolean(),
  priorityBoost: z.boolean(),
  incentiveRupees: z.number().min(0),
});

export type RedispatchValues = z.infer<typeof redispatchSchema>;

/**
 * Re-runs the automation with widened parameters — the admin nudges the auto-assigner
 * (docs/Booking-Workflow-Decisions.md §7). It is NOT a candidate browser, and nothing in this hook
 * fetches or exposes providers, because the moment a list appears the operator starts believing
 * this screen assigns.
 */
export function useRedispatch() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("adminBookingActions");
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.redispatch);
  const announce = useUndoableAction(ADMIN_ACTIONS.redispatch);
  const { idempotencyKey, rotate } = useIdempotencyKey();
  const [isDirty, setIsDirty] = useState(false);

  const query = useQuery<RedispatchContext>({
    queryKey: BOOKING_ACTION_QUERY_KEYS.redispatch(bookingId),
    queryFn: ({ signal }) => fetchRedispatchContext(bookingId, signal),
    enabled: bookingId.length > 0,
  });

  const exit = useCallback(() => {
    void navigate(ROUTES.bookingDetail(bookingId));
  }, [navigate, bookingId]);

  const discard = useDiscardGuard(isDirty, exit);
  const mutation = useMutation({ mutationFn: submitRedispatch });

  const form = useAppForm<RedispatchValues>({
    schema: redispatchSchema,
    // Spending is opt-in: boost off and ₹0 incentive until the operator applies a cost (or the
    // recommended preset) themselves — a default that spends is a default nobody decided.
    defaultValues: {
      radiusId: REDISPATCH_RADII.base,
      relaxSkillMatch: false,
      includeDecliners: false,
      priorityBoost: false,
      incentiveRupees: 0,
    },
    onSubmit: async (values) => {
      await mutation.mutateAsync({
        bookingId,
        version: query.data?.booking.version ?? 0,
        idempotencyKey,
        radiusId: values.radiusId as RedispatchRadiusId,
        relaxSkillMatch: values.relaxSkillMatch,
        includeDecliners: values.includeDecliners,
        priorityBoost: values.priorityBoost,
        incentivePaise: rupeesToPaise(values.incentiveRupees),
      });
      rotate();
      setIsDirty(false);
      // No undo window in the risk register: the search has already started by the time it lands.
      announce({ message: t("redispatch.startedToast"), onUndo: () => setIsDirty(false) });
      exit();
    },
  });

  const { form: redispatchForm } = form;
  const suggestedRadiusId = query.data?.defaultRadiusId;

  // The radius pre-selection comes from the context — one step beyond the last failed round.
  // Re-offering the radius that just failed would make the primary button re-run a known failure.
  useEffect(() => {
    if (suggestedRadiusId === undefined) return;
    redispatchForm.setValue("radiusId", suggestedRadiusId);
  }, [suggestedRadiusId, redispatchForm]);

  return {
    bookingId,
    query,
    form,
    policy,
    decision,
    discard,
    markDirty: () => setIsDirty(true),
    requestExit: discard.requestExit,
  };
}

export type RedispatchState = ReturnType<typeof useRedispatch>;
