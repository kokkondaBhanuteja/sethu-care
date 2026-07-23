// Feature mutation payloads → the generated request bodies, copied field by field so a contract
// drift is a compile error here (the mirror of booking-actions.api.map.ts, which maps responses).
//
// `idempotencyKey` never appears in a body: it travels as the `Idempotency-Key` HEADER, attached in
// booking-actions.api.ts. `version` does appear in every body — the CAS token the operator read;
// a stale one is the server's 409 VERSION_CONFLICT.

import type {
  CancelBookingRequest,
  ManualCompleteRequest,
  RedispatchRequest,
  RefundRequest,
  UndoRequest,
} from "@sethu/api-client";

import type {
  CancelInput,
  ManualCompletionInput,
  RedispatchInput,
  RefundInput,
  UndoInput,
} from "./booking-actions.types";

export function toCancelRequest(input: CancelInput): CancelBookingRequest {
  return {
    version: input.version,
    reasonCode: input.reasonCode,
    note: input.note,
    refund: {
      amountPaise: input.refund.amountPaise,
      isPolicyAmount: input.refund.isPolicyAmount,
      waiveFee: input.refund.waiveFee,
      overrideJustification: input.refund.overrideJustification,
    },
  };
}

export function toRedispatchRequest(input: RedispatchInput): RedispatchRequest {
  return {
    version: input.version,
    radiusId: input.radiusId,
    relaxSkillMatch: input.relaxSkillMatch,
    includeDecliners: input.includeDecliners,
    priorityBoost: input.priorityBoost,
    incentivePaise: input.incentivePaise,
  };
}

export function toManualCompleteRequest(input: ManualCompletionInput): ManualCompleteRequest {
  return {
    version: input.version,
    reasonCode: input.reasonCode,
    note: input.note,
    evidence: {
      workPhotoIds: [...input.evidence.workPhotoIds],
      callAttemptIds: [...input.evidence.callAttemptIds],
      completionReportId: input.evidence.completionReportId,
    },
    attestations: {
      spokeToProvider: input.attestations.spokeToProvider,
      attemptedCustomer: input.attestations.attemptedCustomer,
      believesWorkDone: input.attestations.believesWorkDone,
    },
  };
}

export function toRefundRequest(input: RefundInput): RefundRequest {
  return {
    version: input.version,
    refundType: input.refundType,
    amountPaise: input.amountPaise,
    reasonCode: input.reasonCode,
    note: input.note,
    payoutImpact: input.payoutImpact,
  };
}

export function toUndoRequest(input: UndoInput): UndoRequest {
  return { version: input.version, undoes: input.undoes };
}
