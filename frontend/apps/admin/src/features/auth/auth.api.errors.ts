// The admin auth endpoints' DECLARED failure bodies → this feature's outcome types.
//
// Login and two-factor render their designed failures as *data* (`LoginOutcome`,
// `VerifyOtpOutcome`) rather than thrown errors, because each has its own screen and two carry a
// payload the UI must show — the lockout countdown and the occupied trust slots. Only transport
// failures and undeclared statuses throw, as the console's one ApiError shape:
//
//   login   401 INVALID_CREDENTIALS        → { status: "invalidCredentials" }
//           403 ACCOUNT_DISABLED           → { status: "disabled" }
//           423 ACCOUNT_LOCKED {retryAfter}→ { status: "locked", retryAfterSeconds }
//   2fa     400 INVALID_OTP {attemptsRemaining} → { status: "invalidCode", attemptsRemaining }
//           410 OTP_EXPIRED                → { status: "expired" }
//           423 (attempts exhausted)       → { status: "attemptsExhausted" }
//           409 DEVICE_LIMIT_REACHED {devices} → { status: "deviceLimit", devices }
//   resend  429 (3 per 10 min budget)      → thrown ApiError code "rate_limited"
//
// The 429's `resetAt` has no slot on ApiError (the lib's fixed vocabulary, same trade-off as
// booking-actions) — the OTP screen shows its designed resend-failed line and the server stays
// authoritative about when the budget reopens.

import type { AuthTrustedDevice as ApiAuthTrustedDevice } from "@sethu/api-client";

import { normalizeError } from "../../lib/http/apiError";
import { mapTrustedDevice } from "./auth.api.map";
import { DEVICE_TYPES } from "./auth.types";
import type { LoginOutcome, TrustedDevice, VerifyOtpOutcome } from "./auth.types";

/** The boundary's fallback sentences — one per operation, shared by unwrap and the outer catch. */
export const FAILURE = {
  bootstrap: "The console could not start.",
  login: "Sign-in failed.",
  verify: "The code could not be verified.",
  resend: "A new code could not be sent.",
  revoke: "That device could not be revoked.",
  unlock: "The session could not be unlocked.",
} as const;

/** The slice of the generated result this seam needs; structurally satisfied by every sdk call. */
export interface SdkResult<TData> {
  data?: TData;
  error?: unknown;
  /** Absent only when the request never produced a response; normalizeError copes with that. */
  response?: { status: number; statusText: string };
}

/** Named, because a bare 423 in a conditional reads as a typo for 423 vs 429. */
const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  gone: 410,
  locked: 423,
} as const;

function statusOf(result: SdkResult<unknown>): number | null {
  return result.response?.status ?? null;
}

function numberField(body: unknown, field: string): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "number" ? value : null;
}

/** Returns the payload or throws the failure as an ApiError — never both, never neither. */
export function unwrap<TData>(result: SdkResult<TData>, failureMessage: string): TData {
  if (result.data !== undefined) return result.data;
  return throwFailure(result, failureMessage);
}

/** An undeclared failure leaves as the console's one ApiError shape, status-derived. */
export function throwFailure(result: SdkResult<unknown>, failureMessage: string): never {
  throw normalizeError(result.response, failureMessage);
}

/**
 * One idempotency key per operator intent. Duplicated from booking-actions' useIdempotencyKey
 * fallback because features cannot import siblings — promotion to lib/ is owed (CLAUDE.md).
 */
export function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The login screen's designed refusals, as data. Null means "not a designed failure — throw". */
export function loginFailureOutcome(result: SdkResult<unknown>): LoginOutcome | null {
  const status = statusOf(result);
  if (status === HTTP_STATUS.unauthorized) return { status: "invalidCredentials" };
  if (status === HTTP_STATUS.forbidden) return { status: "disabled" };
  if (status === HTTP_STATUS.locked) {
    const retryAfterSeconds = numberField(result.error, "retryAfter");
    // A lockout without its countdown is a contract violation; the countdown IS the screen.
    if (retryAfterSeconds !== null) return { status: "locked", retryAfterSeconds };
  }
  return null;
}

/** The OTP screen's designed refusals, as data. Null means "not a designed failure — throw". */
export function verifyFailureOutcome(result: SdkResult<unknown>): VerifyOtpOutcome | null {
  const status = statusOf(result);
  if (status === HTTP_STATUS.badRequest) {
    const attemptsRemaining = numberField(result.error, "attemptsRemaining");
    if (attemptsRemaining !== null) return { status: "invalidCode", attemptsRemaining };
  }
  if (status === HTTP_STATUS.gone) return { status: "expired" };
  if (status === HTTP_STATUS.locked) return { status: "attemptsExhausted" };
  if (status === HTTP_STATUS.conflict) {
    const devices = deviceListField(result.error);
    if (devices !== null) return { status: "deviceLimit", devices };
  }
  return null;
}

/** DEVICE_LIMIT_REACHED carries the occupied trust slots so the operator can pick one to evict. */
function deviceListField(body: unknown): readonly TrustedDevice[] | null {
  if (typeof body !== "object" || body === null) return null;
  const devices = (body as { devices?: unknown }).devices;
  if (!Array.isArray(devices) || !devices.every(isDeclaredDevice)) return null;
  return devices.map(mapTrustedDevice);
}

function isDeclaredDevice(value: unknown): value is ApiAuthTrustedDevice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiAuthTrustedDevice>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.lastUsedAt === "string" &&
    typeof candidate.location === "string" &&
    (candidate.type === DEVICE_TYPES.phone ||
      candidate.type === DEVICE_TYPES.tablet ||
      candidate.type === DEVICE_TYPES.desktop)
  );
}
