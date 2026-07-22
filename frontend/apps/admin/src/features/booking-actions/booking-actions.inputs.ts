// The request shapes for every booking-action mutation, split out of `booking-actions.types.ts` so
// neither file grows past the size cap. Re-exported from there, so callers import one module.
//
// Every one of these carries `idempotencyKey`. The backend must honour it as `Idempotency-Key`:
// submitting a refund twice spends real money (docs/admin-api-contract.md §Idempotency).

import type {
  CancelReasonCode,
  ManualCompletionReasonCode,
  RedispatchRadiusId,
  RefundPayoutImpact,
  RefundReasonCode,
  RefundTypeId,
} from "./booking-actions.constants";

/** Every mutation carries the concurrency version and an idempotency key (contract §Conventions). */
interface MutationEnvelope {
  readonly bookingId: string;
  readonly version: number;
  /** Sent as the `Idempotency-Key` header; without it a retried refund is a duplicate refund. */
  readonly idempotencyKey: string;
}

export interface AssignInput extends MutationEnvelope {
  readonly providerId: string;
}

export interface CancelInput extends MutationEnvelope {
  readonly reasonCode: CancelReasonCode;
  readonly note: string;
  readonly refund: {
    readonly amountPaise: number;
    readonly isPolicyAmount: boolean;
    readonly waiveFee: boolean;
    readonly overrideJustification: string;
  };
}

export interface RedispatchInput extends MutationEnvelope {
  readonly radiusId: RedispatchRadiusId;
  readonly relaxSkillMatch: boolean;
  readonly includeDecliners: boolean;
  readonly priorityBoost: boolean;
  readonly incentivePaise: number;
}

export interface ManualCompletionInput extends MutationEnvelope {
  readonly reasonCode: ManualCompletionReasonCode;
  readonly note: string;
  readonly evidence: {
    readonly workPhotoIds: readonly string[];
    readonly callAttemptIds: readonly string[];
    readonly completionReportId: string | null;
  };
  readonly attestations: {
    readonly spokeToProvider: boolean;
    readonly attemptedCustomer: boolean;
    readonly believesWorkDone: boolean;
  };
}

export interface RefundInput extends MutationEnvelope {
  readonly refundType: RefundTypeId;
  readonly amountPaise: number;
  readonly reasonCode: RefundReasonCode;
  readonly note: string;
  readonly payoutImpact: RefundPayoutImpact;
}

/**
 * Reverses an action inside its undo window. It is a compensating, separately audited action rather
 * than a client-side rollback, so it names the action it undoes and carries its own key.
 */
export interface UndoInput extends MutationEnvelope {
  readonly undoes: "assign" | "cancel";
}

export interface ActionReceipt {
  readonly bookingId: string;
  readonly version: number;
}

export interface RefundReceipt extends ActionReceipt {
  readonly refundId: string;
  readonly isPending: boolean;
  readonly estimatedCompletionIso: string | null;
}
