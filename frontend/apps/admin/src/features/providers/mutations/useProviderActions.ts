import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, apiError } from "../../../lib/http/apiError";
import { ADMIN_ACTIONS, type AdminAction } from "../../../lib/permissions/actions";
import { useActionPolicy, useCan } from "../../../lib/permissions/usePermission";
import { useStepUp } from "../../../hooks/useStepUp";
import { useUndoableAction } from "../../../hooks/useUndoableAction";
import { showToast, TOAST_TONES } from "../../../lib/toast/toastStore";
import { restoreProvider, suspendProvider } from "../providers.api";
import { PROVIDER_QUERY_KEYS } from "../providers.constants";
import { SUSPEND_ACTION_TYPES } from "../suspend.types";
import type { SuspendActionType, SuspendProviderInput } from "../suspend.types";

const ROSTER_QUERY_SCOPE = ["providers", "roster"] as const;

/** Which registry entry a chosen action type maps onto. The policy is read, never restated. */
export const ACTION_FOR_SUSPEND_TYPE: Readonly<Record<SuspendActionType, AdminAction>> = {
  [SUSPEND_ACTION_TYPES.forceOffline]: ADMIN_ACTIONS.forceProviderOffline,
  [SUSPEND_ACTION_TYPES.suspend]: ADMIN_ACTIONS.suspendProvider,
  [SUSPEND_ACTION_TYPES.block]: ADMIN_ACTIONS.blockProvider,
};

export interface SuspendMutationOptions {
  /** Confirmation copy, built by the screen that knows the chosen type and duration. */
  readonly doneMessage: string;
  readonly onSuccess: () => void;
}

/**
 * The write path for the suspend / block / force-offline flow.
 *
 * `useCan` is checked HERE as well as at the affordance: hiding a button is not the security model
 * (lib/permissions/can.ts). Step-up and the undo window both come from the action registry, so
 * re-classifying "block" changes this flow without editing it.
 */
export function useSuspendProviderMutation(
  type: SuspendActionType,
  options: SuspendMutationOptions,
) {
  const action = ACTION_FOR_SUSPEND_TYPE[type];
  const queryClient = useQueryClient();
  const { t } = useTranslation("adminProviders");
  const canAct = useCan(action);
  const { policy } = useActionPolicy(action);
  const stepUp = useStepUp(action);
  const announce = useUndoableAction(action);

  const mutation = useMutation({
    mutationFn: async (input: SuspendProviderInput) => {
      if (!canAct) {
        throw apiError(API_ERROR_CODES.forbidden, t("profile.permissionDenied"), { status: 403 });
      }
      return suspendProvider(input);
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: PROVIDER_QUERY_KEYS.profile(input.providerId),
      });
      void queryClient.invalidateQueries({ queryKey: ROSTER_QUERY_SCOPE });
      announce({
        message: options.doneMessage,
        onUndo: () => {
          void restoreProvider(input.providerId).then(() => {
            showToast({ message: t("suspend.undone"), tone: TOAST_TONES.info });
            void queryClient.invalidateQueries({
              queryKey: PROVIDER_QUERY_KEYS.profile(input.providerId),
            });
          });
        },
      });
      options.onSuccess();
    },
  });

  const submit = useCallback(
    async (input: SuspendProviderInput) => {
      if (!canAct) return;
      const isVerified = await stepUp.request();
      if (!isVerified) return;
      await mutation.mutateAsync(input);
    },
    [canAct, stepUp, mutation],
  );

  return { canAct, policy, stepUp, submit, isPending: mutation.isPending };
}

/** Restore reverses a standing decision, so it carries the same guard the decision did. */
export function useRestoreProviderMutation(providerId: string, providerName: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("adminProviders");
  const canAct = useCan(ADMIN_ACTIONS.suspendProvider);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canAct) {
        throw apiError(API_ERROR_CODES.forbidden, t("profile.permissionDenied"), { status: 403 });
      }
      return restoreProvider(providerId);
    },
    onSuccess: () => {
      showToast({
        message: t("profile.restored", { name: providerName }),
        tone: TOAST_TONES.success,
      });
      void queryClient.invalidateQueries({ queryKey: PROVIDER_QUERY_KEYS.profile(providerId) });
      void queryClient.invalidateQueries({ queryKey: ROSTER_QUERY_SCOPE });
    },
  });

  return {
    canAct,
    isPending: mutation.isPending,
    restore: () => {
      mutation.mutate();
    },
  };
}
