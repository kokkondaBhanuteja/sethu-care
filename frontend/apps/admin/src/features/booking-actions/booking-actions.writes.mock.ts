// Mock mutations for the five booking actions.
//
// These rules matter more than the read fixtures: the goodwill cap, the refund rate limit, the
// 30-minute lock and the evidence gates are SERVER-enforced, so the mock enforces them here and the
// screens only mirror the result. A client that decided these itself would be lying about who is in
// charge — and every one of them has a designed failure state that has to be reachable.

import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { mockWrite } from "../../mocks/mockTransport";
import { REFUND_TYPES } from "./booking-actions.constants";
import { FIXTURE_AMOUNTS, MOCK_BOOKINGS } from "./booking-actions.fixtures";
import type {
  ActionReceipt,
  AssignInput,
  CancelInput,
  ManualCompletionInput,
  RedispatchInput,
  RefundInput,
  RefundReceipt,
  UndoInput,
} from "./booking-actions.types";

function options(signal?: AbortSignal): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

function receipt(input: { bookingId: string; version: number }): ActionReceipt {
  return { bookingId: input.bookingId, version: input.version + 1 };
}

export function submitAssignMock(input: AssignInput, signal?: AbortSignal): Promise<ActionReceipt> {
  return mockWrite(() => receipt(input), options(signal));
}

export function submitCancelMock(input: CancelInput, signal?: AbortSignal): Promise<ActionReceipt> {
  return mockWrite(() => receipt(input), options(signal));
}

/**
 * The compensating calls behind the undo windows the risk register grants (30s for assign, 10s for
 * cancel). Undo is a real, separately audited action — not a client-side rollback — which is why it
 * needs its own endpoint rather than a "cancel the previous request" flag.
 */
export function undoActionMock(input: UndoInput, signal?: AbortSignal): Promise<ActionReceipt> {
  return mockWrite(() => receipt(input), options(signal));
}

export function submitRedispatchMock(
  input: RedispatchInput,
  signal?: AbortSignal,
): Promise<ActionReceipt> {
  return mockWrite(() => {
    if (input.incentivePaise > FIXTURE_AMOUNTS.incentiveCapPaise) {
      throw apiError(API_ERROR_CODES.validation, "The incentive exceeds the cap.", {
        status: 422,
        fieldErrors: { incentiveRupees: "Above the 50% cap for this booking." },
      });
    }
    return receipt(input);
  }, options(signal));
}

export function submitManualCompletionMock(
  input: ManualCompletionInput,
  signal?: AbortSignal,
): Promise<ActionReceipt> {
  return mockWrite(() => {
    // 409 TOO_EARLY and 422 EVIDENCE_INSUFFICIENT, exactly as spec §6.14 defines them.
    if (input.bookingId === MOCK_BOOKINGS.tooEarly) {
      throw apiError(API_ERROR_CODES.conflict, "Manual completion is not available yet.", {
        status: 409,
      });
    }
    if (input.evidence.callAttemptIds.length === 0) {
      throw apiError(API_ERROR_CODES.validation, "Log a call attempt to continue.", {
        status: 422,
      });
    }
    return receipt(input);
  }, options(signal));
}

export function submitRefundMock(input: RefundInput, signal?: AbortSignal): Promise<RefundReceipt> {
  return mockWrite(() => {
    if (input.bookingId === MOCK_BOOKINGS.refundRateLimited) {
      throw apiError(API_ERROR_CODES.rateLimited, "Refund limit reached.", { status: 429 });
    }
    if (
      input.refundType === REFUND_TYPES.goodwillCredit &&
      input.amountPaise > FIXTURE_AMOUNTS.goodwillCapPaise
    ) {
      throw apiError(API_ERROR_CODES.validation, "Amount exceeds the goodwill cap.", {
        status: 422,
        fieldErrors: { amountRupees: "Above the goodwill cap." },
      });
    }
    return {
      ...receipt(input),
      refundId: `rfd_${input.idempotencyKey.slice(0, 8)}`,
      // The gateway going quiet is a designed state: the operator is told "pending", never "done".
      isPending: input.bookingId === MOCK_BOOKINGS.goodwillCapExceeded,
      estimatedCompletionIso: "2026-07-27T09:42:00.000Z",
    };
  }, options(signal));
}
