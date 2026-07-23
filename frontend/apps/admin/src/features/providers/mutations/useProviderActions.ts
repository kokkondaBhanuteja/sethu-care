import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, apiError, normalizeError } from "../../../lib/http/apiError";
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

  const invalidateProvider = useCallback(
    (providerId: string) => {
      void queryClient.invalidateQueries({ queryKey: PROVIDER_QUERY_KEYS.profile(providerId) });
      void queryClient.invalidateQueries({ queryKey: ROSTER_QUERY_SCOPE });
    },
    [queryClient],
  );

  const mutation = useMutation({
    mutationFn: async (input: SuspendProviderInput) => {
      if (!canAct) {
        throw apiError(API_ERROR_CODES.forbidden, t("profile.permissionDenied"), { status: 403 });
      }
      return suspendProvider(input);
    },
    onSuccess: (result, input) => {
      invalidateProvider(input.providerId);
      announce({
        message: options.doneMessage,
        onUndo: () => {
          // Undo sends the version AFTER the write; the mock result carries none, so the read
          // version bumped once stands in (the mock ignores it anyway).
          restoreProvider({
            providerId: input.providerId,
            version: result.version ?? input.version + 1,
          })
            .then(() => {
              showToast({ message: t("suspend.undone"), tone: TOAST_TONES.info });
              invalidateProvider(input.providerId);
            })
            .catch((thrown: unknown) => {
              // Losing the undo race is an error the server enforces; surface it, then re-read.
              const error = normalizeError(thrown, t("profile.permissionDenied"));
              showToast({ message: error.message, tone: TOAST_TONES.danger });
              invalidateProvider(input.providerId);
            });
        },
      });
      options.onSuccess();
    },
    onError: (thrown, input) => {
      // A conflict or a 422 (a live job raced in) means the record moved: re-read it so the flow
      // and the profile argue from the server's latest state. The toast bridge announces it.
      const error = normalizeError(thrown, t("profile.permissionDenied"));
      if (error.code === API_ERROR_CODES.conflict || error.code === API_ERROR_CODES.validation) {
        invalidateProvider(input.providerId);
        void queryClient.invalidateQueries({
          queryKey: PROVIDER_QUERY_KEYS.activeJobs(input.providerId),
        });
      }
    },
  });

  const submit = useCallback(
    async (input: SuspendProviderInput) => {
      if (!canAct) return;
      const isVerified = await stepUp.request();
      if (!isVerified) return;
      try {
        await mutation.mutateAsync(input);
      } catch {
        // Already surfaced: the mutation-cache toast announced it and onError re-read the record.
      }
    },
    [canAct, stepUp, mutation],
  );

  return { canAct, policy, stepUp, submit, isPending: mutation.isPending };
}

/** Restore reverses a standing decision, so it carries the same guard the decision did. */
export function useRestoreProviderMutation(
  providerId: string,
  providerName: string,
  version: number,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("adminProviders");
  const canAct = useCan(ADMIN_ACTIONS.suspendProvider);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canAct) {
        throw apiError(API_ERROR_CODES.forbidden, t("profile.permissionDenied"), { status: 403 });
      }
      return restoreProvider({ providerId, version });
    },
    onSuccess: () => {
      showToast({
        message: t("profile.restored", { name: providerName }),
        tone: TOAST_TONES.success,
      });
      void queryClient.invalidateQueries({ queryKey: PROVIDER_QUERY_KEYS.profile(providerId) });
      void queryClient.invalidateQueries({ queryKey: ROSTER_QUERY_SCOPE });
    },
    onError: (thrown) => {
      // A stale version means someone else acted first — re-read so the record tells the truth.
      const error = normalizeError(thrown, t("profile.permissionDenied"));
      if (error.code === API_ERROR_CODES.conflict) {
        void queryClient.invalidateQueries({ queryKey: PROVIDER_QUERY_KEYS.profile(providerId) });
      }
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
