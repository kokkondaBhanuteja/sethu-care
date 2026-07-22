import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 1_000;
const SECONDS_PER_MINUTE = 60;

/**
 * `14:32` — clock form, stated to the second.
 *
 * The countdown IS the message on the lockout and expiry screens: an admin mid-escalation needs to
 * know whether to wait or hand the queue to a colleague, and "a few minutes" does not answer that
 * (design BOX 54). Deliberately not `formatDuration`, which renders ages as `14m 32s`.
 */
export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const seconds = safeSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface Countdown {
  readonly secondsLeft: number;
  readonly label: string;
  readonly hasElapsed: boolean;
  /** Restart from a new duration — a resent code, a fresh lockout window. */
  readonly restart: (seconds: number) => void;
}

/** A once-per-second countdown to zero. Pass 0 for "not running". */
export function useCountdown(initialSeconds: number): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const startedFrom = useRef(initialSeconds);

  // A changed initial value means a new window (a fresh challenge), not a re-render of the old one.
  if (startedFrom.current !== initialSeconds) {
    startedFrom.current = initialSeconds;
    setSecondsLeft(initialSeconds);
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), TICK_MS);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const restart = useCallback((seconds: number) => {
    startedFrom.current = seconds;
    setSecondsLeft(seconds);
  }, []);

  return {
    secondsLeft,
    label: formatClock(secondsLeft),
    hasElapsed: secondsLeft <= 0,
    restart,
  };
}
