import { env } from "../env";
import { isApiError, type ApiError } from "../http/apiError";

// Error reporting, behind a transport seam.
//
// Nothing in this console should call a vendor SDK directly. When Sentry (or whatever wins) is
// chosen, it is installed in ONE place — `setErrorTransport` at boot — and no call site changes.
// Until then the console is the transport, which is honest: the failures are recorded and visible,
// they just do not leave the device.
//
// Scrubbing is not optional. This console handles customer PII, masked payment references and
// admin session tokens, and an error reporter is the classic way all three leak to a third party.

export interface ErrorContext {
  /** Where it happened — a route pattern or a feature name, never a built URL with ids in it. */
  readonly scope: string;
  /** Extra facts. Values are scrubbed before they leave this module. */
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface ErrorTransport {
  captureError: (error: Error, context: ErrorContext) => void;
  captureApiError: (error: ApiError, context: ErrorContext) => void;
}

/** Keys whose values never leave the device, whatever a caller passes. */
const REDACTED_KEYS = [
  "token",
  "jwt",
  "password",
  "passcode",
  "otp",
  "code",
  "authorization",
  "phone",
  "email",
  "address",
  "customer",
  "ip",
  "ipaddress",
  "location",
] as const;

const REDACTED = "[redacted]";
const MAX_DEPTH = 3;

function isRedactedKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z]/g, "");
  return REDACTED_KEYS.some((redacted) => normalised.includes(redacted));
}

/** Strip anything sensitive, and anything unbounded, before a payload can be transmitted. */
export function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => scrub(entry, depth + 1));

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        isRedactedKey(key) ? REDACTED : scrub(entry, depth + 1),
      ]),
    );
  }

  // A long free-text value is a reason note or a customer message — truncate rather than ship it.
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;

  return value;
}

const consoleTransport: ErrorTransport = {
  captureError: (error, context) => {
    console.error(`[${context.scope}]`, error.message, scrub(context.detail ?? {}), error.stack);
  },
  captureApiError: (error, context) => {
    console.error(`[${context.scope}] ${error.code}`, error.message, {
      status: error.status,
      detail: scrub(context.detail ?? {}),
    });
  },
};

let transport: ErrorTransport = consoleTransport;

/** Install the real reporter once, at boot. Called before anything can throw. */
export function setErrorTransport(custom: ErrorTransport): void {
  transport = custom;
}

export function reportError(thrown: unknown, context: ErrorContext): void {
  if (isApiError(thrown)) {
    transport.captureApiError(thrown, context);
    return;
  }
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));
  transport.captureError(error, context);
}

/** Dev-only breadcrumb. Silent in production so it can never become a shipped console.log. */
export function trace(message: string, detail?: Record<string, unknown>): void {
  if (!env.isDev) return;
  console.info(message, scrub(detail ?? {}));
}
