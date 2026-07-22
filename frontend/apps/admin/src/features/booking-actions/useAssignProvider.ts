import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { useAppForm } from "../../lib/forms/useAppForm";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { useUndoableAction } from "../../hooks/useUndoableAction";
import { ROUTES } from "../../routes/routes.constants";
import { fetchAssignContext, submitAssign } from "./booking-actions.api";
import { BOOKING_ACTION_QUERY_KEYS } from "./booking-actions.constants";
import type { AssignContext, ProviderCandidate } from "./booking-actions.types";
import { useIdempotencyKey } from "./useIdempotencyKey";
import { useIsOnline } from "./useIsOnline";

const assignSchema = z.object({ providerId: z.string().min(1) });
type AssignValues = z.infer<typeof assignSchema>;

/**
 * The rescue path, reached only from an escalation (docs/Booking-Workflow-Decisions.md §3.4).
 * Shared by both shells so the mobile card list and the desktop table cannot drift apart.
 */
export function useAssignProvider() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("adminBookingActions");
  const isOnline = useIsOnline();
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.assignProvider);
  const announce = useUndoableAction(ADMIN_ACTIONS.assignProvider);
  const { idempotencyKey, rotate } = useIdempotencyKey();

  const [selected, setSelected] = useState<ProviderCandidate | null>(null);
  const [submitting, setSubmitting] = useState<ProviderCandidate | null>(null);

  const query = useQuery<AssignContext>({
    queryKey: BOOKING_ACTION_QUERY_KEYS.assign(bookingId),
    queryFn: ({ signal }) => fetchAssignContext(bookingId, signal),
    enabled: bookingId.length > 0 && isOnline,
  });

  const close = useCallback(() => {
    void navigate(ROUTES.bookingDetail(bookingId));
  }, [navigate, bookingId]);

  const mutation = useMutation({
    mutationFn: (values: AssignValues) =>
      submitAssign({
        bookingId,
        version: query.data?.booking.version ?? 0,
        idempotencyKey,
        providerId: values.providerId,
      }),
  });

  const form = useAppForm<AssignValues>({
    schema: assignSchema,
    defaultValues: { providerId: "" },
    onSubmit: async (values) => {
      const provider =
        query.data?.candidates.find((row) => row.providerId === values.providerId) ?? null;
      await mutation.mutateAsync(values);
      rotate();
      setSelected(null);
      setSubmitting(null);
      // The undo window comes from the risk register, never from a number written here.
      announce({
        message: t("assign.assignedToast", { name: provider?.name ?? "" }),
        onUndo: () => setSelected(provider),
      });
      close();
    },
  });

  const { form: rhf, handleSubmit } = form;

  /** Commits one candidate. The value is pushed into the form first so the in-flight guard owns it. */
  const assign = useCallback(
    (candidate: ProviderCandidate) => {
      setSubmitting(candidate);
      rhf.setValue("providerId", candidate.providerId);
      void handleSubmit();
    },
    [rhf, handleSubmit],
  );

  const clearSelection = useCallback(() => setSelected(null), []);
  const isBlockedOffline = !isOnline || (query.data?.isBlockedOffline ?? false);

  return useMemo(
    () => ({
      bookingId,
      query,
      policy,
      decision,
      isBlockedOffline,
      selected,
      submittingProviderId: submitting?.providerId ?? null,
      select: setSelected,
      clearSelection,
      assign,
      isSubmitting: form.isSubmitting,
      close,
    }),
    [
      bookingId,
      query,
      policy,
      decision,
      isBlockedOffline,
      selected,
      submitting,
      clearSelection,
      assign,
      form.isSubmitting,
      close,
    ],
  );
}

export type AssignProviderState = ReturnType<typeof useAssignProvider>;
