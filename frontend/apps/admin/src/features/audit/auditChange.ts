// Rendering a state transition.
//
// The arrow is U+2192 (→), the glyph the bundled fonts carry for exactly this. It is written as an
// escape rather than pasted so nobody re-saves the file in a codepage that eats it, and it is
// wrapped in the transition string itself so a translator cannot separate the two states.

import type { AuditStateSnapshot } from "./audit.types";

export const TRANSITION_ARROW = "→";

export interface AuditTransition {
  /** The snapshot field, e.g. `state`, `refunded`, `provider`. */
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

/**
 * Pairs `before` and `after` by field. Fields present on only one side still produce a row — a
 * value that appeared or disappeared is exactly the kind of change a dispute turns on.
 */
export function toTransitions(
  before: AuditStateSnapshot,
  after: AuditStateSnapshot,
): readonly AuditTransition[] {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields.map((field) => ({
    field,
    before: before[field] ?? "—",
    after: after[field] ?? "—",
  }));
}

/** `Waiting Completion OTP → Completed (Admin Verified)` — the ledger's Change column. */
export function transitionText(transition: AuditTransition): string {
  return `${transition.before} ${TRANSITION_ARROW} ${transition.after}`;
}

export function changeSummary(before: AuditStateSnapshot, after: AuditStateSnapshot): string {
  return toTransitions(before, after).map(transitionText).join(" · ");
}
