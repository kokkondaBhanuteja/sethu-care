import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@sethu/core";

import { useIsDesktop } from "../../hooks/useBreakpoint";
import { ROUTES } from "../../routes/routes.constants";
import { bootstrapApp } from "./auth.api";
import { AUTH_QUERY_KEYS, SLOW_BOOT_MS } from "./auth.constants";
import { readAuthRouterState, resumePath } from "./authRouterState";

/** What the splash is showing. It is a decision point, not a branding moment (spec §6.1). */
export type SplashPhase = "booting" | "slow" | "error" | "updateRequired";

export interface UseSplashBootResult {
  phase: SplashPhase;
  retry: () => void;
  signOut: () => void;
}

/**
 * Bootstrap and route, inside the 800 ms the spec budgets for a routing decision.
 *
 * No spinner: one that flashes for 200 ms reads as jank, so the screen stays still and only admits
 * to being slow after three seconds (design BOX 79/80).
 */
export function useSplashBoot(): UseSplashBootResult {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const sessionStatus = useSession((state) => state.status);
  const endSession = useSession((state) => state.signOut);

  const [isSlow, setIsSlow] = useState(false);

  const bootstrap = useQuery({
    queryKey: AUTH_QUERY_KEYS.bootstrap,
    queryFn: ({ signal }) => bootstrapApp(signal),
    // A failed boot is the designed "Couldn't start" screen with its own Retry, not a silent
    // background retry the admin watches nothing happen during.
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_BOOT_MS);
    return () => clearTimeout(timer);
  }, []);

  const bootstrapData = bootstrap.data;
  const isSessionResolved = sessionStatus !== "loading";
  const hasSession = sessionStatus === "authenticated";
  // Read inside the effect: the parsed object is a new reference every render, and depending on it
  // would re-run the navigation on every tick.
  const historyState: unknown = location.state;

  useEffect(() => {
    if (!bootstrapData || !isSessionResolved) return;
    if (!bootstrapData.isVersionSupported) return;

    const routerState = readAuthRouterState(historyState);

    if (!hasSession) {
      void navigate(ROUTES.login, { replace: true, state: routerState });
      return;
    }
    // Biometric is a device capability, so it only stands between the admin and the console on a
    // phone; desktop's equivalent is the password lock (spec §5.4, design BOX 58).
    if (bootstrapData.isBiometricEnabled && !isDesktop) {
      void navigate(ROUTES.unlock, { replace: true, state: routerState });
      return;
    }
    void navigate(resumePath(routerState), { replace: true });
  }, [bootstrapData, hasSession, historyState, isDesktop, isSessionResolved, navigate]);

  const retry = useCallback(() => {
    setIsSlow(false);
    void bootstrap.refetch();
  }, [bootstrap]);

  const signOut = useCallback(() => {
    // A stale session is a plausible cause of a failed start — the second thing to try, not the first.
    void endSession().then(() => navigate(ROUTES.login, { replace: true }));
  }, [endSession, navigate]);

  return { phase: derivePhase(), retry, signOut };

  function derivePhase(): SplashPhase {
    if (bootstrapData && !bootstrapData.isVersionSupported) return "updateRequired";
    if (bootstrap.isError) return "error";
    return isSlow ? "slow" : "booting";
  }
}
