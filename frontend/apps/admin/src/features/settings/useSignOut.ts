import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { ROUTES } from "../../routes/routes.constants";
import { fetchQueuedActionCount, signOutServerSide } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";

/**
 * Sign-out (spec §6.22, §5.6).
 *
 * On logout — voluntary, expired or remotely revoked — all cached data is destroyed. Clearing the
 * QueryClient is the load-bearing half of that: dropping the token alone would leave the previous
 * admin's bookings, roster and customer PII sitting in memory for whoever signs in next, and a
 * revoked device must retain nothing of operational value.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOutSession = useSession((state) => state.signOut);
  const { t } = useTranslation("adminSettings");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const queuedActionsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.queuedActions,
    queryFn: ({ signal }) => fetchQueuedActionCount(signal),
  });

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      // Server-side bookkeeping first, best-effort: sessions are stateless JWTs, so the token
      // lives to its TTL either way, and a failed logout call must never trap an admin in a
      // session they asked to leave. The local destruction below is the load-bearing half.
      await signOutServerSide().catch(() => undefined);
      await signOutSession();
      queryClient.clear();
      await navigate(ROUTES.login, { replace: true });
    } catch {
      showToast({ message: t("signOut.failed"), tone: TOAST_TONES.danger });
      setIsSigningOut(false);
    }
  };

  return {
    /** Unsynced offline actions. Zero while the count is still loading — never guessed upward. */
    queuedActions: queuedActionsQuery.data ?? 0,
    isSigningOut,
    signOut,
  };
}
