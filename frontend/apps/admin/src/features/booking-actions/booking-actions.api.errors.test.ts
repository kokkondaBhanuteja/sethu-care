import { describe, expect, it } from "vitest";

import { isApiError, type ApiError } from "../../lib/http/apiError";
import {
  CANCEL_FIELD_RENAMES,
  REDISPATCH_FIELD_RENAMES,
  REFUND_FIELD_RENAMES,
  unwrap,
  type SdkResult,
} from "./booking-actions.api.errors";

const FALLBACK = "The action could not be completed.";

function failure(status: number, body?: unknown): SdkResult<never> {
  return { error: body, response: { status, statusText: "" } };
}

function thrownBy(result: SdkResult<never>, renames?: Readonly<Record<string, string>>): ApiError {
  try {
    unwrap(result, FALLBACK, renames);
  } catch (thrown) {
    if (isApiError(thrown)) return thrown;
    throw new Error("unwrap threw something that is not an ApiError", { cause: thrown });
  }
  throw new Error("unwrap did not throw");
}

describe("unwrap", () => {
  it("returns the payload untouched when the call succeeded", () => {
    const receipt = { bookingId: "b-1", version: 5 };

    expect(unwrap({ data: receipt, response: { status: 200, statusText: "" } }, FALLBACK)).toBe(
      receipt,
    );
  });

  it("maps 409 VERSION_CONFLICT onto the conflict code with the concurrent-change sentence", () => {
    const error = thrownBy(
      failure(409, { code: "VERSION_CONFLICT", message: "stale", currentVersion: 7 }),
    );

    expect(error.code).toBe("conflict");
    expect(error.status).toBe(409);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("changed while you were working");
  });

  it("maps 409 TOO_EARLY onto conflict with the mock's lock sentence", () => {
    const error = thrownBy(
      failure(409, { code: "TOO_EARLY", message: "locked", availableAt: "2026-07-14T07:00:00Z" }),
    );

    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Manual completion is not available yet.");
  });

  it("maps 422 EVIDENCE_INSUFFICIENT onto validation with the call-attempt sentence", () => {
    const error = thrownBy(
      failure(422, { code: "EVIDENCE_INSUFFICIENT", message: "missing", missing: ["callAttempt"] }),
    );

    expect(error.code).toBe("validation");
    expect(error.message).toBe("Log a call attempt to continue.");
  });

  it("renames the cap error's amountPaise onto the rupee form field", () => {
    const error = thrownBy(
      failure(422, {
        code: "EXCEEDS_CAP",
        message: "cap",
        capPaise: 50_000,
        fields: { amountPaise: "Above the goodwill cap for this booking." },
      }),
      REFUND_FIELD_RENAMES,
    );

    expect(error.fieldErrors).toEqual({
      amountRupees: "Above the goodwill cap for this booking.",
    });
  });

  it("still lands a field error on the amount when EXCEEDS_CAP arrives without fields", () => {
    const error = thrownBy(
      failure(422, { code: "EXCEEDS_CAP", message: "cap", capPaise: 50_000 }),
      REFUND_FIELD_RENAMES,
    );

    expect(error.fieldErrors).toEqual({ amountRupees: "Above the goodwill cap." });
  });

  it("maps 429 RATE_LIMITED onto the retryable rate_limited code", () => {
    const error = thrownBy(
      failure(429, { code: "RATE_LIMITED", message: "later", resetAt: "2026-07-14T08:00:00Z" }),
    );

    expect(error.code).toBe("rate_limited");
    expect(error.retryable).toBe(true);
    expect(error.message).toBe("Refund limit reached.");
  });

  it("passes undeclared field names through under their own names", () => {
    const error = thrownBy(
      failure(422, {
        code: "VALIDATION",
        message: "invalid",
        fields: { overrideJustification: "Required for a custom amount.", incentivePaise: "High." },
      }),
      REDISPATCH_FIELD_RENAMES,
    );

    expect(error.fieldErrors).toEqual({
      overrideJustification: "Required for a custom amount.",
      incentiveRupees: "High.",
    });
    expect(error.message).toBe(FALLBACK);
  });

  it("renames both spellings of the cancel refund amount onto customAmountRupees", () => {
    const nested = thrownBy(
      failure(422, {
        code: "VALIDATION",
        message: "invalid",
        fields: { "refund.amountPaise": "More than the booking value." },
      }),
      CANCEL_FIELD_RENAMES,
    );

    expect(nested.fieldErrors).toEqual({ customAmountRupees: "More than the booking value." });
  });

  it("falls back to the status-derived error when the body is not a declared shape", () => {
    const error = thrownBy(failure(500, "<html>gateway timeout</html>"));

    expect(error.code).toBe("server");
    expect(error.status).toBe(500);
    expect(error.message).toBe(FALLBACK);
    expect(error.fieldErrors).toBeUndefined();
  });
});
