// The only boundary between the booking-action screens and their data.
//
// None of these endpoints exists yet — docs/admin-api-contract.md lists them under
// "MISSING — bookings". When they land, each mock call below is replaced by the generated client's
// call and nothing above this file changes.
//
// Every mutation sends an `Idempotency-Key`. The backend MUST honour it: submitting a refund twice
// spends real money, and the in-flight guard in useAppForm only protects one browser tab.

import { normalizeError } from "../../lib/http/apiError";
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
} from "./booking-actions.types";

async function read<TData>(load: () => Promise<TData>, failure: string): Promise<TData> {
  try {
    return await load();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

export function fetchAssignContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<AssignContext> {
  return read(
    () => fetchAssignContextMock(bookingId, signal),
    "The candidate list could not be loaded.",
  );
}

export function fetchCancelContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<CancelContext> {
  return read(() => fetchCancelContextMock(bookingId, signal), "This booking could not be loaded.");
}

export function fetchRedispatchContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RedispatchContext> {
  return read(
    () => fetchRedispatchContextMock(bookingId, signal),
    "The dispatch history could not be loaded.",
  );
}

export function fetchManualCompletionContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<ManualCompletionContext> {
  return read(
    () => fetchManualCompletionContextMock(bookingId, signal),
    "The completion evidence could not be loaded.",
  );
}

export function fetchRefundContext(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RefundContext> {
  return read(
    () => fetchRefundContextMock(bookingId, signal),
    "The refund details could not be loaded.",
  );
}

async function write<TResult>(send: () => Promise<TResult>, failure: string): Promise<TResult> {
  try {
    return await send();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

export function submitAssign(input: AssignInput): Promise<ActionReceipt> {
  return write(() => submitAssignMock(input), "The provider could not be assigned.");
}

export function submitCancel(input: CancelInput): Promise<ActionReceipt> {
  return write(() => submitCancelMock(input), "The booking could not be cancelled.");
}

export function submitRedispatch(input: RedispatchInput): Promise<ActionReceipt> {
  return write(() => submitRedispatchMock(input), "Dispatch could not be re-run.");
}

export function submitManualCompletion(input: ManualCompletionInput): Promise<ActionReceipt> {
  return write(
    () => submitManualCompletionMock(input),
    "The booking could not be completed manually.",
  );
}

export function submitRefund(input: RefundInput): Promise<RefundReceipt> {
  return write(() => submitRefundMock(input), "The refund could not be issued.");
}
