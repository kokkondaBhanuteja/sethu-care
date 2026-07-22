import { ROUTES } from "../../routes/routes.constants";
import type { OtpChallenge } from "./auth.types";

/** A location RequireAuth captured, reduced to the parts needed to rebuild the URL. */
export interface ResumeTarget {
  readonly pathname: string;
  readonly search?: string;
  readonly hash?: string;
}

/**
 * Router state shared by the pre-auth screens: the destination the operator was actually trying to
 * reach, plus the pending second factor as login hands over to /login/otp.
 */
export interface AuthRouterState {
  readonly from?: ResumeTarget;
  readonly challenge?: OtpChallenge;
}

function isResumeTarget(value: unknown): value is ResumeTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ResumeTarget).pathname === "string"
  );
}

/** Narrow `useLocation().state`, which react-router types as `any`-shaped history state. */
export function readAuthRouterState(state: unknown): AuthRouterState {
  if (typeof state !== "object" || state === null) return {};

  const candidate = state as { from?: unknown; challenge?: unknown };
  const from = isResumeTarget(candidate.from) ? candidate.from : undefined;
  const challenge = isOtpChallenge(candidate.challenge) ? candidate.challenge : undefined;

  return { ...(from ? { from } : {}), ...(challenge ? { challenge } : {}) };
}

function isOtpChallenge(value: unknown): value is OtpChallenge {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OtpChallenge).challengeId === "string"
  );
}

/**
 * Where a completed sign-in lands.
 *
 * Never the dashboard when a destination was captured: the reason the operator opened the app is
 * usually a push about a booking that is on fire, and dropping them on /live discards it
 * (spec §3.4 rule 1).
 */
export function resumePath(state: AuthRouterState): string {
  if (!state.from) return ROUTES.live;
  return `${state.from.pathname}${state.from.search ?? ""}${state.from.hash ?? ""}`;
}
