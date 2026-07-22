import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useActionPolicy } from "../../lib/permissions/usePermission";
import { useStepUp } from "../../hooks/useStepUp";
import { fetchSecuritySettings, revokeDevice, saveBiometricUnlock } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";
import { useSignOut } from "./useSignOut";
import type { SecuritySettings, TrustedDevice } from "./settings.types";

/**
 * Security & devices (spec §6.31). Revoking a device is `device.revoke` in the action registry —
 * high risk, step-up required, no reason code, no undo — and this hook reads that policy rather
 * than restating it, so a change to the register reaches this screen without a code change here.
 *
 * Revoking the CURRENT device ends the session it is running in, so it completes by signing out and
 * destroying every cache (spec §5.6): a revoked device must retain nothing of operational value.
 */
export function useSecuritySettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("adminSettings");
  const { policy, decision } = useActionPolicy(ADMIN_ACTIONS.revokeDevice);
  const stepUp = useStepUp(ADMIN_ACTIONS.revokeDevice);
  const { signOut } = useSignOut();

  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.security,
    queryFn: ({ signal }) => fetchSecuritySettings(signal),
  });

  const biometricMutation = useMutation({
    mutationFn: (enabled: boolean) => saveBiometricUnlock(enabled),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEYS.security });
      const previous = queryClient.getQueryData<SecuritySettings>(SETTINGS_QUERY_KEYS.security);
      if (previous) {
        queryClient.setQueryData<SecuritySettings>(SETTINGS_QUERY_KEYS.security, {
          ...previous,
          biometricUnlock: enabled,
        });
      }
      return { previous };
    },
    // The failure toast is raised centrally; this only puts the switch back where it was.
    onError: (_error, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.security, context.previous);
      }
    },
    onSettled: (updated) => {
      if (updated) queryClient.setQueryData(SETTINGS_QUERY_KEYS.security, updated);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (device: TrustedDevice) => revokeDevice(device.id),
    onSuccess: async (updated, device) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.security, updated);
      if (device.isCurrent) {
        await signOut();
        return;
      }
      showToast({
        message: t("security.revoked", { device: device.name }),
        tone: TOAST_TONES.success,
      });
    },
  });

  return {
    query,
    policy,
    canRevoke: decision.allowed,
    stepUp,
    isRevoking: revokeMutation.isPending,
    toggleBiometric: (enabled: boolean) => biometricMutation.mutate(enabled),
    revoke: (device: TrustedDevice) => revokeMutation.mutate(device),
  };
}
