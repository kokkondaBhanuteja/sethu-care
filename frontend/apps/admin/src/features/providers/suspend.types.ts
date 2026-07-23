// The suspend / block / force-offline flow (spec §6.19). Step 3's active-job handling is the
// reason this has its own shapes: a suspension that strands a customer mid-job is the failure the
// whole four-step flow exists to prevent.

export const SUSPEND_ACTION_TYPES = {
  forceOffline: "force_offline",
  suspend: "suspend",
  block: "block",
} as const;

export type SuspendActionType = (typeof SUSPEND_ACTION_TYPES)[keyof typeof SUSPEND_ACTION_TYPES];

export const SUSPEND_REASON_CODES = {
  safetyComplaint: "safety_complaint",
  repeatedCancellations: "repeated_cancellations",
  poorQuality: "poor_quality",
  fraudSuspected: "fraud_suspected",
  documentExpired: "document_expired",
  unprofessional: "unprofessional",
  noShowPattern: "no_show_pattern",
  policyViolation: "policy_violation",
  other: "other",
} as const;

export type SuspendReasonCode = (typeof SUSPEND_REASON_CODES)[keyof typeof SUSPEND_REASON_CODES];

export const ACTIVE_JOB_STAGES = { enRoute: "en_route", inProgress: "in_progress" } as const;
export type ActiveJobStage = (typeof ACTIVE_JOB_STAGES)[keyof typeof ACTIVE_JOB_STAGES];

export interface ProviderActiveJob {
  readonly bookingId: string;
  readonly stage: ActiveJobStage;
  readonly service: string;
  readonly customerName: string;
  readonly zone: string;
  readonly amountPaise: number;
  readonly etaMinutes?: number;
  readonly startedAt?: string;
  /** Who the mock/backend would hand this booking to — shown once the operator picks Reassign. */
  readonly suggestedProviderName: string;
}

export const JOB_RESOLUTIONS = { reassign: "reassign", letFinish: "let_finish" } as const;
export type JobResolution = (typeof JOB_RESOLUTIONS)[keyof typeof JOB_RESOLUTIONS];

/** bookingId → how the operator chose to handle it. Absent means still unresolved. */
export type JobResolutionMap = Readonly<Record<string, JobResolution | undefined>>;

export interface SuspendProviderInput {
  readonly providerId: string;
  readonly version: number;
  readonly type: SuspendActionType;
  readonly durationDays: number | null;
  readonly reasonCode: SuspendReasonCode;
  readonly note: string;
  readonly jobResolutions: JobResolutionMap;
  readonly notifyImmediately: boolean;
}

export interface SuspendProviderResult {
  readonly providerId: string;
  readonly type: SuspendActionType;
  readonly durationDays: number | null;
  readonly effectiveUntil: string | null;
  /** The record's version AFTER the write — what the undo's restore must send. Absent in mocks. */
  readonly version?: number;
}

/** Restore reverses the standing decision, so it carries the same CAS token every write does. */
export interface RestoreProviderInput {
  readonly providerId: string;
  readonly version: number;
}
