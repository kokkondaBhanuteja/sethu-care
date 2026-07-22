import { useCallback, useRef, useState } from "react";

import { policyFor, type AdminAction } from "../lib/permissions/actions";

/**
 * Step-up verification is valid for 60 seconds (spec §5.5) — long enough to finish a multi-field
 * flow, short enough that a device is never left armed.
 */
const STEP_UP_TTL_MS = 60_000;

export interface StepUpState {
  /** True when this action needs verification and none is currently fresh. */
  isRequired: boolean;
  /** True while the challenge is on screen. */
  isChallenging: boolean;
  /** Ask for verification. Resolves true once the operator passes, false if they cancel. */
  request: () => Promise<boolean>;
  /** Called by the challenge UI when verification succeeds. */
  confirm: () => void;
  /** Called by the challenge UI when the operator backs out. */
  cancel: () => void;
}

/**
 * Fresh verification for destructive and financial actions — not a tap-to-confirm dialog, which
 * operators learn to dismiss reflexively (spec §5.5).
 *
 * Whether an action needs this is read from the action registry, never decided at the call site,
 * so the policy lives in exactly one place.
 *
 * On native this is where the Capacitor biometric plugin hooks in; on web the challenge is a
 * passcode. Either way the caller only sees `request()`.
 */
export function useStepUp(action: AdminAction): StepUpState {
  const requiresStepUp = policyFor(action).requiresStepUp;
  const [isChallenging, setIsChallenging] = useState(false);
  const verifiedAtRef = useRef<number | null>(null);
  const resolverRef = useRef<((passed: boolean) => void) | null>(null);

  const isFresh = () => {
    const verifiedAt = verifiedAtRef.current;
    return verifiedAt !== null && Date.now() - verifiedAt < STEP_UP_TTL_MS;
  };

  const request = useCallback((): Promise<boolean> => {
    if (!requiresStepUp || isFresh()) return Promise.resolve(true);

    setIsChallenging(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [requiresStepUp]);

  const confirm = useCallback(() => {
    verifiedAtRef.current = Date.now();
    setIsChallenging(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    setIsChallenging(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  return {
    isRequired: requiresStepUp && !isFresh(),
    isChallenging,
    request,
    confirm,
    cancel,
  };
}
