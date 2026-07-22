import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, apiError, isApiError, normalizeError, type ApiError } from "./apiError";

// Everything thrown anywhere in this console arrives here and leaves as one ApiError. Two things
// depend on that being right: ErrorState picks its copy from `code`, and it only offers Retry when
// `retryable` is true. Mislabel a 403 as retryable and the console hands an operator a button that
// can never work; mislabel a 500 as not retryable and it hides the one that would.

const FALLBACK = "This could not be loaded.";

describe("status to code", () => {
  it.each([
    [400, API_ERROR_CODES.validation],
    [401, API_ERROR_CODES.unauthorized],
    [403, API_ERROR_CODES.forbidden],
    [404, API_ERROR_CODES.notFound],
    [409, API_ERROR_CODES.conflict],
    [422, API_ERROR_CODES.validation],
    [429, API_ERROR_CODES.rateLimited],
  ])("maps %i to %s", (status, code) => {
    expect(normalizeError({ status }, FALLBACK).code).toBe(code);
  });

  it("treats every 5xx as a server failure, including ones nobody enumerated", () => {
    // 503 and 504 are what a deploy and an overloaded gateway actually produce, and both must reach
    // the retryable branch rather than falling into `unknown` by accident.
    expect(normalizeError({ status: 500 }, FALLBACK).code).toBe(API_ERROR_CODES.server);
    expect(normalizeError({ status: 503 }, FALLBACK).code).toBe(API_ERROR_CODES.server);
    expect(normalizeError({ status: 504 }, FALLBACK).code).toBe(API_ERROR_CODES.server);
  });

  it("collapses an unrecognised 4xx to unknown rather than guessing at its meaning", () => {
    expect(normalizeError({ status: 418 }, FALLBACK).code).toBe(API_ERROR_CODES.unknown);
  });

  it("keeps the status on the error, because the fatal state prints it for support", () => {
    expect(normalizeError({ status: 409 }, FALLBACK).status).toBe(409);
  });

  it("prefers the server's statusText over the caller's fallback sentence", () => {
    expect(
      normalizeError({ status: 409, statusText: "Booking already cancelled" }, FALLBACK),
    ).toMatchObject({ message: "Booking already cancelled" });
    // An empty statusText is what most JSON APIs send; it must not become the operator's message.
    expect(normalizeError({ status: 409, statusText: "" }, FALLBACK).message).toBe(FALLBACK);
  });
});

describe("retryability", () => {
  it.each([
    API_ERROR_CODES.network,
    API_ERROR_CODES.timeout,
    API_ERROR_CODES.server,
    API_ERROR_CODES.rateLimited,
    API_ERROR_CODES.unknown,
  ])("offers a retry for %s, because the identical request could still succeed", (code) => {
    expect(apiError(code, FALLBACK).retryable).toBe(true);
  });

  it.each([
    API_ERROR_CODES.unauthorized,
    API_ERROR_CODES.forbidden,
    API_ERROR_CODES.notFound,
    API_ERROR_CODES.conflict,
    API_ERROR_CODES.validation,
  ])("refuses a retry for %s, because repeating it changes nothing", (code) => {
    expect(apiError(code, FALLBACK).retryable).toBe(false);
  });

  it("derives retryability from the code even when the error came in as a status", () => {
    expect(normalizeError({ status: 500 }, FALLBACK).retryable).toBe(true);
    expect(normalizeError({ status: 403 }, FALLBACK).retryable).toBe(false);
  });
});

describe("thrown values that are not responses", () => {
  it("reads a TypeError as a network failure — fetch() rejects that way when nothing was reached", () => {
    const error = normalizeError(new TypeError("Failed to fetch"), FALLBACK);
    expect(error.code).toBe(API_ERROR_CODES.network);
    expect(error.retryable).toBe(true);
    expect(error.status).toBeNull();
  });

  it("reads an AbortError as a timeout, so an abandoned request never reads as a server fault", () => {
    const error = normalizeError(new DOMException("Aborted", "AbortError"), FALLBACK);
    expect(error.code).toBe(API_ERROR_CODES.timeout);
    expect(error.retryable).toBe(true);
  });

  it("keeps a plain Error's own message, which is usually the only clue there is", () => {
    expect(normalizeError(new Error("Boom"), FALLBACK)).toMatchObject({
      code: API_ERROR_CODES.unknown,
      message: "Boom",
    });
  });

  it.each([null, undefined, "a string", 42])(
    "still produces a usable error for %s, so no screen renders a blank failure",
    (thrown) => {
      expect(normalizeError(thrown, FALLBACK)).toMatchObject({
        code: API_ERROR_CODES.unknown,
        message: FALLBACK,
        status: null,
      });
    },
  );
});

describe("errors that are already normalised", () => {
  it("passes one straight through, so re-wrapping at a second boundary cannot downgrade it", () => {
    // Every .api.ts wraps its call in normalizeError, and mocks already throw ApiErrors. Without
    // this identity the mock's 429 would be re-read as a generic `unknown` on the way up.
    const original = apiError(API_ERROR_CODES.rateLimited, "Too many refunds in five minutes.", {
      status: 429,
    });

    expect(normalizeError(original, FALLBACK)).toBe(original);
  });

  it("carries field errors through the second pass intact", () => {
    // The form layer reads fieldErrors to paint the offending control red. Losing them turns a
    // precise "Amount exceeds the cap" into an unattributed banner.
    const original = apiError(API_ERROR_CODES.validation, "Check the highlighted fields.", {
      status: 422,
      fieldErrors: { amountPaise: "Above the goodwill cap.", reasonCode: "Required." },
    });

    const normalized = normalizeError(original, FALLBACK);
    expect(normalized.fieldErrors).toEqual({
      amountPaise: "Above the goodwill cap.",
      reasonCode: "Required.",
    });
  });

  it("omits fieldErrors entirely when there are none, rather than sending an empty object", () => {
    expect(apiError(API_ERROR_CODES.server, FALLBACK)).not.toHaveProperty("fieldErrors");
  });
});

describe("isApiError", () => {
  it("recognises the shape the UI branches on", () => {
    expect(isApiError(apiError(API_ERROR_CODES.network, FALLBACK))).toBe(true);
  });

  it.each([null, undefined, "not an error", new Error("plain"), { status: 500 }])(
    "rejects %s, so nothing that lacks a code reaches a screen unchecked",
    (value: unknown) => {
      expect(isApiError(value)).toBe(false);
    },
  );

  it("narrows the type, which is what keeps `unknown` out of the screens", () => {
    const thrown: unknown = apiError(API_ERROR_CODES.forbidden, "Not yours.");
    if (!isApiError(thrown)) throw new Error("expected an ApiError");
    const narrowed: ApiError = thrown;
    expect(narrowed.code).toBe(API_ERROR_CODES.forbidden);
  });
});
