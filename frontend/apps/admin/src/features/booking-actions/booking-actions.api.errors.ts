// The rescue endpoints' DECLARED failure bodies → the console's one ApiError shape, so every
// designed failure state the mocks reach is reached identically in real mode:
//
//   409 VERSION_CONFLICT {currentVersion}   → code "conflict"     (concurrent-change toast path)
//   409 TOO_EARLY        {availableAt}      → code "conflict"     (the 30-minute lock)
//   422 EVIDENCE_INSUFFICIENT {missing[]}   → code "validation"   (the evidence gate)
//   422 EXCEEDS_CAP      {capPaise, fields} → code "validation"   + field error ON the amount field
//   429 RATE_LIMITED     {resetAt}          → code "rate_limited" (form replaced via context refetch)
//
// ApiError is the lib's fixed vocabulary — the structured extras (currentVersion, availableAt,
// missing[], resetAt) are not carried on it; the screens that need them re-read their context,
// which the server keeps authoritative (availableInMinutes, rateLimitResetsAtIso, evidence).

import { normalizeError, type ApiError } from "../../lib/http/apiError";

/** The boundary's fallback sentences — one per operation, shared by unwrap and the outer catch. */
export const FAILURE = {
  assignContext: "The candidate list could not be loaded.",
  cancelContext: "This booking could not be loaded.",
  redispatchContext: "The dispatch history could not be loaded.",
  manualContext: "The completion evidence could not be loaded.",
  refundContext: "The refund details could not be loaded.",
  assign: "The provider could not be assigned.",
  cancel: "The booking could not be cancelled.",
  undo: "That could not be undone.",
  redispatch: "Dispatch could not be re-run.",
  manualComplete: "The booking could not be completed manually.",
  refund: "The refund could not be issued.",
} as const;

/** The slice of the generated result this seam needs; structurally satisfied by every sdk call. */
export interface SdkResult<TData> {
  data?: TData;
  error?: unknown;
  /** Absent only when the request never produced a response; normalizeError copes with that. */
  response?: { status: number; statusText: string };
}

/** Every declared failure body carries at least these (AdminError and its specialisations). */
interface DeclaredErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

function isDeclaredErrorBody(value: unknown): value is DeclaredErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DeclaredErrorBody>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

/**
 * Operator-facing sentences per declared code — the same copy the mocks used, so the designed
 * states read identically. The server's `message` is diagnostic and never rendered verbatim
 * (contract §Errors); EXCEEDS_CAP guarantees a field error on the amount even if the body's
 * `fields` went missing, because that designed state lives ON the field.
 */
const DECLARED_FAILURES: Readonly<
  Record<string, { message: string; fieldErrors?: Readonly<Record<string, string>> }>
> = {
  VERSION_CONFLICT: {
    message:
      "This booking changed while you were working. Reopen it to continue from the latest state.",
  },
  TOO_EARLY: { message: "Manual completion is not available yet." },
  EVIDENCE_INSUFFICIENT: { message: "Log a call attempt to continue." },
  EXCEEDS_CAP: {
    message: "Amount exceeds the goodwill cap.",
    fieldErrors: { amountRupees: "Above the goodwill cap." },
  },
  RATE_LIMITED: { message: "Refund limit reached." },
};

/** Server request field → the form control it belongs to (the forms edit rupees, the wire paise). */
export const REFUND_FIELD_RENAMES: Readonly<Record<string, string>> = {
  amountPaise: "amountRupees",
};

export const REDISPATCH_FIELD_RENAMES: Readonly<Record<string, string>> = {
  incentivePaise: "incentiveRupees",
};

export const CANCEL_FIELD_RENAMES: Readonly<Record<string, string>> = {
  amountPaise: "customAmountRupees",
  "refund.amountPaise": "customAmountRupees",
};

function renameFields(
  fields: Record<string, string> | undefined,
  renames: Readonly<Record<string, string>>,
): Record<string, string> | undefined {
  if (!fields) return undefined;
  const renamed: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields)) {
    renamed[renames[field] ?? field] = message;
  }
  return Object.keys(renamed).length > 0 ? renamed : undefined;
}

/**
 * Returns the payload or throws the failure as an ApiError — status-derived code, curated
 * operator sentence for the declared failures, and the server's per-field messages renamed onto
 * the form controls that own them (so field errors still land on fields, exactly as the mocks').
 */
export function unwrap<TData>(
  result: SdkResult<TData>,
  failureMessage: string,
  fieldRenames: Readonly<Record<string, string>> = {},
): TData {
  if (result.data !== undefined) return result.data;

  const base = normalizeError(result.response, failureMessage);
  if (!isDeclaredErrorBody(result.error)) throw base;

  const declared = DECLARED_FAILURES[result.error.code];
  const fieldErrors = renameFields(result.error.fields, fieldRenames) ?? declared?.fieldErrors;
  throw {
    ...base,
    message: declared?.message ?? base.message,
    ...(fieldErrors ? { fieldErrors } : {}),
  } satisfies ApiError;
}
