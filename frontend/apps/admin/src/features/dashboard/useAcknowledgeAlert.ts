import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { acknowledgeAlert } from "./dashboard.api";
import { DASHBOARD_QUERY_KEYS, RESOLVE_ANIMATION_MS } from "./dashboard.constants";

export interface AcknowledgeTarget {
  readonly alertId: string;
  readonly bookingRef: string;
}

export interface AcknowledgeController {
  acknowledge: (target: AcknowledgeTarget) => void;
  /** Alert ids currently animating out. A row in this set is dimmed and flashes "Resolved". */
  readonly resolvingIds: ReadonlySet<string>;
  readonly isPending: boolean;
}

/**
 * `alert.acknowledge` — low risk, no step-up, no undo window, audited (lib/permissions/actions).
 *
 * The row does not vanish the instant the button is pressed: it holds for 240ms with a "Resolved"
 * flash so the operator can see which one went (spec §6.6 — an item disappearing under the thumb
 * causes mis-taps). A rejection reverts the optimistic removal and says so in a toast.
 */
export function useAcknowledgeAlert(): AcknowledgeController {
  const { t } = useTranslation("adminDashboard");
  const queryClient = useQueryClient();
  const [resolvingIds, setResolvingIds] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearResolving = useCallback((alertId: string) => {
    timers.current.delete(alertId);
    setResolvingIds((current) => {
      const next = new Set(current);
      next.delete(alertId);
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: (target: AcknowledgeTarget) => acknowledgeAlert(target.alertId),
    onSuccess: (_result, target) => {
      showToast({
        message: t("actions.acknowledged", { booking: target.bookingRef }),
        tone: TOAST_TONES.success,
      });
      const timer = setTimeout(() => {
        clearResolving(target.alertId);
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.band() });
      }, RESOLVE_ANIMATION_MS);
      timers.current.set(target.alertId, timer);
    },
    onError: (_error, target) => {
      // The mutation cache already raised the generic failure toast; this one names the record so
      // the operator knows which row came back rather than hunting for it.
      clearResolving(target.alertId);
      showToast({
        message: t("actions.acknowledgeFailed", { booking: target.bookingRef }),
        tone: TOAST_TONES.danger,
      });
    },
  });

  const acknowledge = useCallback(
    (target: AcknowledgeTarget) => {
      if (timers.current.has(target.alertId)) return;
      setResolvingIds((current) => new Set(current).add(target.alertId));
      mutation.mutate(target);
    },
    [mutation],
  );

  return { acknowledge, resolvingIds, isPending: mutation.isPending };
}
