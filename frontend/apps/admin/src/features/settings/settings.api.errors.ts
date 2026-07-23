// The settings endpoints' failure seam: every sdk result leaves this feature as the console's one
// ApiError shape. The only DECLARED failure bodies here are AdminError (422 on a diagnostics
// payload that carried PII, 422 on a critical channel in a notification PATCH) — both surface
// through the status-derived `validation` code; the screens own the operator-facing sentence.

import { normalizeError } from "../../lib/http/apiError";

/** The boundary's fallback sentences — one per operation, shared by unwrap and the outer catch. */
export const FAILURE = {
  notifications: "Notification settings could not be loaded.",
  saveNotifications: "Those notification settings could not be saved.",
  security: "Security settings could not be loaded.",
  biometric: "Biometric unlock could not be changed.",
  revoke: "That device could not be revoked.",
  profile: "Your profile could not be loaded.",
  savePreferences: "That preference could not be saved.",
  version: "Version details could not be loaded.",
  payouts: "The payout cycle could not be loaded.",
  queuedActions: "Queued actions could not be counted.",
  diagnostics: "Diagnostics could not be sent.",
  logout: "Sign out could not be recorded.",
} as const;

/** The slice of the generated result this seam needs; structurally satisfied by every sdk call. */
export interface SdkResult<TData> {
  data?: TData;
  error?: unknown;
  /** Absent only when the request never produced a response; normalizeError copes with that. */
  response?: { status: number; statusText: string };
}

/** Returns the payload or throws the failure as an ApiError — never both, never neither. */
export function unwrap<TData>(result: SdkResult<TData>, failureMessage: string): TData {
  if (result.data !== undefined) return result.data;
  return throwFailure(result, failureMessage);
}

/** A failed sdk result leaves as the console's one ApiError shape, status-derived. */
export function throwFailure(result: SdkResult<unknown>, failureMessage: string): never {
  throw normalizeError(result.response, failureMessage);
}

/**
 * One idempotency key per operator intent — a toggle flip, a revoke tap, a diagnostics send.
 * Duplicated from booking-actions' useIdempotencyKey fallback because features cannot import
 * siblings; promotion to lib/ is owed (CLAUDE.md).
 */
export function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The header every write shares — minted per operator intent, one call being one intent here. */
export function idempotencyHeader() {
  return { headers: { "Idempotency-Key": mintIdempotencyKey() } };
}

/** Everything thrown at the settings boundary leaves as an ApiError. */
export async function call<TResult>(
  run: () => Promise<TResult>,
  failure: string,
): Promise<TResult> {
  try {
    return await run();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}
