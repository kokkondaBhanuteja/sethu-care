import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { SHELL_QUERY_KEYS } from "../../queries/useShellCounters";
import { useAckQueueStore } from "./ackQueue.store";
import { acknowledgeAlert } from "./alerts.api";
import { ALERTS_QUERY_KEYS } from "./alerts.constants";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * Module-scoped, not a ref: the desktop feed and its preview pane each hold a controller, and a
 * per-instance flag would let both drain the same queue and send every acknowledgement twice.
 */
let isDraining = false;

export interface AcknowledgeController {
  acknowledge: (alertId: string) => void;
  /** From the action registry — this screen never restates the policy (spec §10.2). */
  readonly canAcknowledge: boolean;
  readonly isOnline: boolean;
  readonly queuedIds: readonly string[];
  isQueued: (alertId: string) => boolean;
  isSending: (alertId: string) => boolean;
}

/**
 * The single write this feature owns. `acknowledgeAlert` is low risk: no step-up, no reason code and
 * no undo window, but audited — all read from the registry, never restated here.
 *
 * Two rules make this hook worth its own file:
 *   1. It invalidates the shell counters, because the Alerts badge counts unacknowledged criticals
 *      and must drop the instant one is owned (spec §3.1). A badge that lags is a badge nobody
 *      believes.
 *   2. Losing the race is not a failure. The endpoint is idempotent; a second acknowledger is told
 *      who won and the row updates (spec §6.20 edge cases).
 */
export function useAcknowledgeAlert(): AcknowledgeController {
  const { t } = useTranslation("adminAlerts");
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { decision } = useActionPolicy(ADMIN_ACTIONS.acknowledgeAlert);

  const queuedIds = useAckQueueStore((state) => state.queued);
  const enqueue = useAckQueueStore((state) => state.enqueue);
  const dequeue = useAckQueueStore((state) => state.dequeue);

  const mutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(alertId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEYS.root });
      void queryClient.invalidateQueries({ queryKey: SHELL_QUERY_KEYS.counters });
      showToast(
        result.wonRace
          ? { message: t("toast.acknowledged"), tone: TOAST_TONES.success }
          : {
              message: t("toast.alreadyAcknowledged", {
                name: result.alert.acknowledgement?.adminName ?? "",
              }),
              tone: TOAST_TONES.info,
            },
      );
    },
  });

  const { mutate, mutateAsync } = mutation;

  const acknowledge = useCallback(
    (alertId: string) => {
      if (!decision.allowed) return;
      if (!isOnline) {
        enqueue(alertId);
        showToast({ message: t("toast.queued"), tone: TOAST_TONES.info });
        return;
      }
      mutate(alertId);
    },
    [decision.allowed, enqueue, isOnline, mutate, t],
  );

  // Replay on reconnect, one at a time so a failure does not abandon the rest of the queue.
  useEffect(() => {
    if (!isOnline || queuedIds.length === 0 || isDraining) return;
    isDraining = true;
    void (async () => {
      for (const alertId of queuedIds) {
        try {
          await mutateAsync(alertId);
        } catch {
          // The mutation cache already raised the failure toast; keep draining the rest.
        }
        dequeue(alertId);
      }
      isDraining = false;
    })();
  }, [dequeue, isOnline, mutateAsync, queuedIds]);

  const isQueued = useCallback((alertId: string) => queuedIds.includes(alertId), [queuedIds]);

  const isSending = useCallback(
    (alertId: string) => mutation.isPending && mutation.variables === alertId,
    [mutation.isPending, mutation.variables],
  );

  return {
    acknowledge,
    canAcknowledge: decision.allowed,
    isOnline,
    queuedIds,
    isQueued,
    isSending,
  };
}
