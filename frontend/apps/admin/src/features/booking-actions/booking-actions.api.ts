// The only boundary between the booking-action screens and their data.
//
// The rescue endpoints are REAL (backend internal/rescue, all eleven operations): with mocks off,
// every read is sdk call → pure mapper → feature types, and every mutation sends the operator's
// `Idempotency-Key` header plus the CAS `version` they read. The mock branch is untouched, so unit
// tests and designed-state walks behave exactly as before — nothing above this file changed.
//
// Every mutation sends an `Idempotency-Key`. The backend honours it: submitting a refund twice
// spends real money, and the in-flight guard in useAppForm only protects one browser tab.

import {
  assignBooking,
  opsAssignContext,
  opsCancelBooking,
  opsCancelContext,
  opsManualCompleteBooking,
  opsManualCompletionContext,
  opsRedispatchBooking,
  opsRedispatchContext,
  opsRefundBooking,
  opsRefundContext,
  opsUndoAssign,
  opsUndoCancel,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  CANCEL_FIELD_RENAMES,
  FAILURE,
  REDISPATCH_FIELD_RENAMES,
  REFUND_FIELD_RENAMES,
  unwrap,
} from "./booking-actions.api.errors";
import {
  assignReceiptFrom,
  mapActionReceipt,
  mapAssignContext,
  mapCancelContext,
  mapManualCompletionContext,
  mapRedispatchContext,
  mapRefundContext,
  mapRefundReceipt,
} from "./booking-actions.api.map";
import {
  toCancelRequest,
  toManualCompleteRequest,
  toRedispatchRequest,
  toRefundRequest,
  toUndoRequest,
} from "./booking-actions.api.requests";
import {
  fetchAssignContextMock,
  fetchCancelContextMock,
  fetchManualCompletionContextMock,
  fetchRedispatchContextMock,
  fetchRefundContextMock,
} from "./booking-actions.mock";
import {
  submitAssignMock,
  submitCancelMock,
  submitManualCompletionMock,
  submitRedispatchMock,
  submitRefundMock,
  undoActionMock,
} from "./booking-actions.writes.mock";
import type {
  ActionReceipt,
  AssignContext,
  AssignInput,
  CancelContext,
  CancelInput,
  ManualCompletionContext,
  ManualCompletionInput,
  RedispatchContext,
  RedispatchInput,
  RefundContext,
  RefundInput,
  RefundReceipt,
  UndoInput,
} from "./booking-actions.types";

/** Everything thrown at this boundary leaves as an ApiError — declared bodies via unwrap. */
async function call<TResult>(run: () => Promise<TResult>, failure: string): Promise<TResult> {
  try {
    return await run();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

/** The wire envelope every mutation shares: the record path + the operator's idempotency key. */
function envelope(input: { bookingId: string; idempotencyKey: string }) {
  return {
    path: { id: input.bookingId },
    headers: { "Idempotency-Key": input.idempotencyKey },
  };
}

export function fetchAssignContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<AssignContext> {
  return call(async () => {
    if (env.useMocks) return fetchAssignContextMock(bookingId, signal);
    const result = await opsAssignContext({ path: { id: bookingId }, signal });
    return mapAssignContext(unwrap(result, FAILURE.assignContext));
  }, FAILURE.assignContext);
}

export function fetchCancelContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<CancelContext> {
  return call(async () => {
    if (env.useMocks) return fetchCancelContextMock(bookingId, signal);
    const result = await opsCancelContext({ path: { id: bookingId }, signal });
    return mapCancelContext(unwrap(result, FAILURE.cancelContext));
  }, FAILURE.cancelContext);
}

export function fetchRedispatchContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RedispatchContext> {
  return call(async () => {
    if (env.useMocks) return fetchRedispatchContextMock(bookingId, signal);
    const result = await opsRedispatchContext({ path: { id: bookingId }, signal });
    return mapRedispatchContext(unwrap(result, FAILURE.redispatchContext));
  }, FAILURE.redispatchContext);
}

export function fetchManualCompletionContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<ManualCompletionContext> {
  return call(async () => {
    if (env.useMocks) return fetchManualCompletionContextMock(bookingId, signal);
    const result = await opsManualCompletionContext({ path: { id: bookingId }, signal });
    return mapManualCompletionContext(unwrap(result, FAILURE.manualContext));
  }, FAILURE.manualContext);
}

export function fetchRefundContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RefundContext> {
  return call(async () => {
    if (env.useMocks) return fetchRefundContextMock(bookingId, signal);
    const result = await opsRefundContext({ path: { id: bookingId }, signal });
    return mapRefundContext(unwrap(result, FAILURE.refundContext));
  }, FAILURE.refundContext);
}

export function submitAssign(input: AssignInput): Promise<ActionReceipt> {
  return call(async () => {
    if (env.useMocks) return submitAssignMock(input);
    // The assign COMMIT is the phase-0 op: `technician_id` body, no version field yet. The
    // idempotency key is sent anyway — the header is honoured even though this op omits it.
    const result = await assignBooking({
      ...envelope(input),
      body: { technician_id: input.providerId },
    });
    return assignReceiptFrom(input, unwrap(result, FAILURE.assign));
  }, FAILURE.assign);
}

export function submitCancel(input: CancelInput): Promise<ActionReceipt> {
  return call(async () => {
    if (env.useMocks) return submitCancelMock(input);
    const result = await opsCancelBooking({ ...envelope(input), body: toCancelRequest(input) });
    return mapActionReceipt(unwrap(result, FAILURE.cancel, CANCEL_FIELD_RENAMES));
  }, FAILURE.cancel);
}

/**
 * Reverses an assign or a cancel inside the window the risk register grants it. The window is
 * SERVER-enforced from the real event timestamps — losing the race is an error, not a no-op.
 */
export function undoAction(input: UndoInput): Promise<ActionReceipt> {
  return call(async () => {
    if (env.useMocks) return undoActionMock(input);
    const options = { ...envelope(input), body: toUndoRequest(input) };
    if (input.undoes === "assign") {
      const result = await opsUndoAssign(options);
      return mapActionReceipt(unwrap(result, FAILURE.undo));
    }
    // CancelUndoReceipt also reports whether the refund could be reversed; ActionReceipt (the
    // normative shape) has no slot for it yet, so the flags are not surfaced — noted in CLAUDE.md.
    const result = await opsUndoCancel(options);
    return mapActionReceipt(unwrap(result, FAILURE.undo));
  }, FAILURE.undo);
}

export function submitRedispatch(input: RedispatchInput): Promise<ActionReceipt> {
  return call(async () => {
    if (env.useMocks) return submitRedispatchMock(input);
    const result = await opsRedispatchBooking({
      ...envelope(input),
      body: toRedispatchRequest(input),
    });
    return mapActionReceipt(unwrap(result, FAILURE.redispatch, REDISPATCH_FIELD_RENAMES));
  }, FAILURE.redispatch);
}

export function submitManualCompletion(input: ManualCompletionInput): Promise<ActionReceipt> {
  return call(async () => {
    if (env.useMocks) return submitManualCompletionMock(input);
    const result = await opsManualCompleteBooking({
      ...envelope(input),
      body: toManualCompleteRequest(input),
    });
    return mapActionReceipt(unwrap(result, FAILURE.manualComplete));
  }, FAILURE.manualComplete);
}

export function submitRefund(input: RefundInput): Promise<RefundReceipt> {
  return call(async () => {
    if (env.useMocks) return submitRefundMock(input);
    const result = await opsRefundBooking({ ...envelope(input), body: toRefundRequest(input) });
    return mapRefundReceipt(unwrap(result, FAILURE.refund, REFUND_FIELD_RENAMES));
  }, FAILURE.refund);
}
