// The providerops endpoints' DECLARED failure bodies → the console's one ApiError shape, so every
// designed failure state the mocks reach is reached identically in real mode:
//
//   409 VERSION_CONFLICT {currentVersion}  → code "conflict"  (the record moved; screens re-read)
//   409 ALREADY_DECIDED  {decision}        → code "conflict"  (another admin decided first — the
//                                            review re-reads and renders the informational banner)
//   422 (unresolved job / short note / approval blocked / nothing to request)
//                                          → code "validation" + a curated per-operation sentence,
//                                            with the reject note's error landing ON its field
//
// The 422s ride the transport's generic error model (no `code`/`fields` body — backend
// httpapi/errors.go classify()), so the curated sentence and the field placement are supplied
// per operation here. The structured extras on the declared 409s (`currentVersion`, `decision`)
// have no slot on ApiError; the screens re-read their record, which the server keeps
// authoritative. Mirrors booking-actions.api.errors.ts — the seam is a promotion candidate once
// a third feature repeats it.

import { normalizeError, type ApiError } from "../../lib/http/apiError";

/** The boundary's fallback sentences — one per operation, shared by unwrap and the outer catch. */
export const FAILURE = {
  roster: "The provider roster could not be loaded.",
  profile: "This provider could not be loaded.",
  activeJobs: "This provider's active jobs could not be loaded.",
  suspend: "The suspension could not be applied.",
  restore: "This provider could not be restored.",
  queue: "The applications queue could not be loaded.",
  review: "This application could not be loaded.",
  approve: "This application could not be approved.",
  reject: "This application could not be rejected.",
  requestDocuments: "The document request could not be sent.",
} as const;

/** The slice of the generated result this seam needs; structurally satisfied by every sdk call. */
export interface SdkResult<TData> {
  data?: TData;
  error?: unknown;
  /** Absent only when the request never produced a response; normalizeError copes with that. */
  response?: { status: number; statusText: string };
}

/** Both declared 409 bodies carry at least these (staleVersionError / applicationDecidedError). */
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

interface CuratedFailure {
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

/**
 * Operator-facing sentences per declared code. The server's `message` is diagnostic and never
 * rendered verbatim (contract §Errors).
 */
const DECLARED_FAILURES: Readonly<Record<string, CuratedFailure>> = {
  VERSION_CONFLICT: {
    message:
      "This record changed while you were working. Reload it to continue from the latest state.",
  },
  ALREADY_DECIDED: { message: "Another admin already decided this application." },
};

/** Per-status curated sentences for the undeclared failures, chosen per operation at the caller. */
export type StatusFailures = Readonly<Record<number, CuratedFailure>>;

export const SUSPEND_STATUS_FAILURES: StatusFailures = {
  // A live job appeared (or was left dangling) between the read and the write.
  422: { message: "A live job is still unresolved. Reload and resolve every active job first." },
};

export const RESTORE_STATUS_FAILURES: StatusFailures = {
  422: { message: "This provider is not suspended or blocked." },
};

export const APPROVE_STATUS_FAILURES: StatusFailures = {
  // The server recomputed the blockers and refused; the re-read renders them over the dead button.
  422: { message: "Approval is blocked — see the blockers on this application." },
};

export const REJECT_STATUS_FAILURES: StatusFailures = {
  // The 20-character floor is server-enforced; the designed state lives ON the note field.
  422: {
    message: "The rejection note must be at least 20 characters.",
    fieldErrors: { note: "At least 20 characters." },
  },
};

export const REQUEST_DOCUMENTS_STATUS_FAILURES: StatusFailures = {
  422: { message: "There are no missing documents to request on this application." },
};

/**
 * Returns the payload or throws the failure as an ApiError — status-derived code, curated
 * operator sentence for the declared and per-status failures, and the field errors placed on the
 * form controls that own them. Never surfaces the server's own text.
 */
export function unwrap<TData>(
  result: SdkResult<TData>,
  failureMessage: string,
  statusFailures: StatusFailures = {},
): TData {
  if (result.data !== undefined) return result.data;

  const base = normalizeError(result.response, failureMessage);
  const declared = isDeclaredErrorBody(result.error)
    ? DECLARED_FAILURES[result.error.code]
    : undefined;
  const curated =
    declared ?? (result.response ? statusFailures[result.response.status] : undefined);

  throw {
    ...base,
    message: curated?.message ?? failureMessage,
    ...(curated?.fieldErrors ? { fieldErrors: curated.fieldErrors } : {}),
  } satisfies ApiError;
}
