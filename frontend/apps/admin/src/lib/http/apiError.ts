// One error shape for the whole console. Generated-client failures, mock failures and network
// failures all arrive here and leave as an ApiError, so ErrorState only ever renders one type and
// screens never branch on `unknown`.

/** Error codes the UI branches on. Everything else collapses to `unknown`. */
export const API_ERROR_CODES = {
  network: "network",
  timeout: "timeout",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  conflict: "conflict",
  validation: "validation",
  rateLimited: "rate_limited",
  server: "server",
  unknown: "unknown",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiError {
  readonly code: ApiErrorCode;
  /** Operator-facing sentence. Already localized by the thrower where one exists. */
  readonly message: string;
  readonly status: number | null;
  /** True when retrying the identical request could plausibly succeed. */
  readonly retryable: boolean;
  /** Field-level messages keyed by form field name, when the backend returned them. */
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

const STATUS_TO_CODE: ReadonlyMap<number, ApiErrorCode> = new Map([
  [400, API_ERROR_CODES.validation],
  [401, API_ERROR_CODES.unauthorized],
  [403, API_ERROR_CODES.forbidden],
  [404, API_ERROR_CODES.notFound],
  [409, API_ERROR_CODES.conflict],
  [422, API_ERROR_CODES.validation],
  [429, API_ERROR_CODES.rateLimited],
]);

const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([
  API_ERROR_CODES.network,
  API_ERROR_CODES.timeout,
  API_ERROR_CODES.server,
  API_ERROR_CODES.rateLimited,
  API_ERROR_CODES.unknown,
]);

function codeForStatus(status: number): ApiErrorCode {
  return (
    STATUS_TO_CODE.get(status) ?? (status >= 500 ? API_ERROR_CODES.server : API_ERROR_CODES.unknown)
  );
}

/** Build an ApiError directly — used by mock services and by client-side guards. */
export function apiError(
  code: ApiErrorCode,
  message: string,
  extra: { status?: number; fieldErrors?: Record<string, string> } = {},
): ApiError {
  return {
    code,
    message,
    status: extra.status ?? null,
    retryable: RETRYABLE_CODES.has(code),
    ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
  };
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiError>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

interface ResponseLike {
  status: number;
  statusText?: string;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ResponseLike).status === "number"
  );
}

/** Narrow anything thrown at a trust boundary into the one shape the UI understands. */
export function normalizeError(thrown: unknown, fallbackMessage: string): ApiError {
  if (isApiError(thrown)) return thrown;

  if (isResponseLike(thrown)) {
    const code = codeForStatus(thrown.status);
    return apiError(code, thrown.statusText || fallbackMessage, { status: thrown.status });
  }

  if (thrown instanceof DOMException && thrown.name === "AbortError") {
    return apiError(API_ERROR_CODES.timeout, fallbackMessage);
  }

  if (thrown instanceof TypeError) {
    // fetch() rejects with TypeError when the request never reached a server.
    return apiError(API_ERROR_CODES.network, fallbackMessage);
  }

  if (thrown instanceof Error) {
    return apiError(API_ERROR_CODES.unknown, thrown.message || fallbackMessage);
  }

  return apiError(API_ERROR_CODES.unknown, fallbackMessage);
}
