import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { API_ERROR_CODES, apiError } from "../http/apiError";
import { useAppForm } from "./useAppForm";

// The duplicate-submission guard is the reason this wrapper exists. Admin mutations cancel bookings
// and issue refunds, and the backend's idempotency key is not in place on them yet — so a second
// submit that reaches `onSubmit` spends money twice. Everything else here is ordinary form plumbing;
// that one property is a safety property.

const schema = z.object({
  amount: z.string().min(1, "Enter an amount."),
  reason: z.string().min(3, "Reason must be at least 3 characters."),
});

type RefundValues = z.infer<typeof schema>;

const VALID: RefundValues = { amount: "1200", reason: "Provider no-show" };

function setup(onSubmit: (values: RefundValues) => Promise<void>, values: RefundValues = VALID) {
  return renderHook(() => useAppForm({ schema, defaultValues: values, onSubmit }));
}

/** A promise the test releases by hand, so a submission can be held mid-flight. */
function gate() {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("the duplicate-submission guard", () => {
  it("ignores a second submit raised while the first is still in flight", async () => {
    const inFlight = gate();
    const onSubmit = vi.fn(() => inFlight.promise);
    const { result } = setup(onSubmit);

    await act(async () => {
      void result.current.handleSubmit();
    });
    expect(result.current.isSubmitting).toBe(true);

    // The operator taps Confirm again because the first tap looked like it did nothing.
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      inFlight.release();
      await inFlight.promise;
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("ignores a second submit fired in the same tick as the first — a double tap or a double click", async () => {
    // Two clicks 40ms apart land in the same React commit. If the guard reads render state rather
    // than a ref, both handlers see "not submitting" and the refund is issued twice.
    const inFlight = gate();
    const onSubmit = vi.fn(() => inFlight.promise);
    const { result } = setup(onSubmit);

    await act(async () => {
      void result.current.handleSubmit();
      void result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      inFlight.release();
      await inFlight.promise;
    });
  });

  it("accepts a fresh submit once the first has settled, so a failed refund can be retried", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight flag when the submission throws, rather than locking the form forever", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("gateway refused")));
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.isSubmitting).toBe(false);
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

describe("validation", () => {
  it("never calls onSubmit with values the schema rejects", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { result } = setup(onSubmit, { amount: "", reason: "no" });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("exposes the schema's own message per field, so the control can print it verbatim", async () => {
    const { result } = setup(vi.fn(async () => undefined), { amount: "", reason: "no" });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.errorFor("amount")).toBe("Enter an amount.");
    });
    expect(result.current.errorFor("reason")).toBe("Reason must be at least 3 characters.");
  });

  it("reports no error for a field that passed", async () => {
    const { result } = setup(vi.fn(async () => undefined), { amount: "", reason: "Long enough" });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.errorFor("amount")).toBe("Enter an amount.");
    });
    expect(result.current.errorFor("reason")).toBeUndefined();
  });
});

describe("API failures", () => {
  it("maps the backend's per-field messages onto the matching controls", async () => {
    // The backend is the only authority on the goodwill cap, so its message has to reach the field
    // it belongs to rather than a generic banner the operator has to interpret.
    const onSubmit = vi.fn(() =>
      Promise.reject(
        apiError(API_ERROR_CODES.validation, "Check the highlighted fields.", {
          status: 422,
          fieldErrors: { amount: "Above the goodwill cap for this booking." },
        }),
      ),
    );
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.errorFor("amount")).toBe("Above the goodwill cap for this booking.");
    });
  });

  it("ignores a field name the form does not have, instead of throwing on the way to the screen", async () => {
    const onSubmit = vi.fn(() =>
      Promise.reject(
        apiError(API_ERROR_CODES.validation, "Rejected.", {
          fieldErrors: { somethingElse: "Not a field on this form." },
        }),
      ),
    );
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.formError?.message).toBe("Rejected.");
  });

  it("surfaces a whole-form failure as a normalised ApiError, never as a raw throw", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.formError).toMatchObject({
      code: API_ERROR_CODES.network,
      retryable: true,
    });
  });

  it("clears the previous failure when the operator submits again", async () => {
    let shouldFail = true;
    const onSubmit = vi.fn(() =>
      shouldFail ? Promise.reject(new Error("first attempt failed")) : Promise.resolve(),
    );
    const { result } = setup(onSubmit);

    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.formError).not.toBeNull();

    shouldFail = false;
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.formError).toBeNull();
  });
});

describe("reset", () => {
  it("puts the values back and drops the error, so a reopened flow starts clean", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("nope")));
    const { result } = setup(onSubmit);

    act(() => {
      result.current.form.setValue("amount", "9999");
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.formError).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.form.getValues("amount")).toBe(VALID.amount);
    expect(result.current.formError).toBeNull();
  });
});
