// The provider-application pipeline (spec §6.17, §6.18, §7.5).

import type { DocumentTypeKey } from "./providers.types";

export const APPLICATION_SEGMENTS = {
  pending: "pending",
  awaitingDocs: "awaitingDocs",
  decided: "decided",
} as const;

export type ApplicationSegment = (typeof APPLICATION_SEGMENTS)[keyof typeof APPLICATION_SEGMENTS];

export const APPLICATION_STATUSES = {
  pending: "pending",
  awaitingDocs: "awaiting_docs",
  approved: "approved",
  rejected: "rejected",
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];

export interface ApplicationRow {
  readonly id: string;
  readonly applicantName: string;
  readonly categories: readonly string[];
  readonly zone: string;
  readonly appliedAt: string;
  /** Null once decided — the 48-hour clock stops with the decision (M74). */
  readonly daysWaiting: number | null;
  readonly documentsPresent: number;
  readonly documentsRequired: number;
  readonly status: ApplicationStatus;
  /** Names the document the applicant still owes, for "Awaiting police verification". */
  readonly awaitingDocumentKey?: DocumentTypeKey;
  readonly decidedAt?: string;
}

export interface ApplicationCounts {
  readonly pending: number;
  readonly awaitingDocs: number;
  readonly decided: number;
}

export interface ApplicationQueue {
  readonly rows: readonly ApplicationRow[];
  readonly counts: ApplicationCounts;
  /** Age of the oldest undecided application, against the 48-hour SLA. */
  readonly oldestDays: number;
}

export const DOCUMENT_VALIDATIONS = {
  validated: "validated",
  failed: "failed",
  missing: "missing",
} as const;

export type DocumentValidation = (typeof DOCUMENT_VALIDATIONS)[keyof typeof DOCUMENT_VALIDATIONS];

export interface ApplicationDocument {
  readonly id: string;
  readonly typeKey: DocumentTypeKey;
  readonly validation: DocumentValidation;
  readonly uploadedAt?: string;
  readonly expiresAt?: string;
  /** Account tail, certificate number — whatever the row shows instead of an expiry. */
  readonly detail?: string;
  readonly sizeLabel?: string;
  /** OCR verdict shown under a failed row: what was read, and what was expected. */
  readonly ocrRead?: string;
  readonly ocrExpected?: string;
  /** Lines the desktop viewer draws in place of the scan; the pages hold with zero network. */
  readonly pageLineWidths?: readonly number[];
  readonly pageHeading?: string;
  readonly pageNameLine?: string;
}

export const AUTO_CHECK_LABEL_KEYS = {
  expiry: "review.checkExpiry",
  blur: "review.checkBlur",
  ocr: "review.checkOcr",
} as const;

export type AutoCheckLabelKey = (typeof AUTO_CHECK_LABEL_KEYS)[keyof typeof AUTO_CHECK_LABEL_KEYS];

export interface AutoValidationCheck {
  readonly id: string;
  readonly labelKey: AutoCheckLabelKey;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface ApplicationCategory {
  readonly name: string;
  readonly yearsClaimed: number;
}

export interface ApplicationDecision {
  readonly outcome: "approved" | "rejected";
  readonly byName: string;
  readonly at: string;
}

/**
 * A blocker the SERVER computed. The console mirrors it so the reason is readable next to the
 * dead control (BOX 47 / M73); it never decides on its own that approval is allowed.
 */
export const BLOCKER_MESSAGE_KEYS = {
  policeVerification: "review.blockerPoliceVerification",
  missingDocument: "review.blockerMissingDocument",
  expiredDocument: "review.blockerExpiredDocument",
} as const;

export type BlockerMessageKey = (typeof BLOCKER_MESSAGE_KEYS)[keyof typeof BLOCKER_MESSAGE_KEYS];

export interface ApprovalBlocker {
  readonly id: string;
  readonly messageKey: BlockerMessageKey;
  readonly documentKey?: DocumentTypeKey;
}

export interface ApplicationReview {
  readonly id: string;
  readonly applicantName: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly appliedAt: string;
  readonly daysWaiting: number | null;
  readonly categories: readonly ApplicationCategory[];
  readonly documents: readonly ApplicationDocument[];
  readonly documentsRequired: number;
  readonly backgroundClearedAt: string | null;
  readonly priorApplications: number;
  readonly autoValidation: readonly AutoValidationCheck[];
  readonly approvalBlockers: readonly ApprovalBlocker[];
  readonly decision?: ApplicationDecision;
  readonly version: number;
}

export const REJECT_REASON_CODES = {
  incompleteDocumentation: "incomplete_documentation",
  failedBackgroundCheck: "failed_background_check",
  insufficientExperience: "insufficient_experience",
  outsideServiceArea: "outside_service_area",
  duplicateApplication: "duplicate_application",
  authenticityConcern: "authenticity_concern",
  capacityFull: "capacity_full",
  other: "other",
} as const;

export type RejectReasonCode = (typeof REJECT_REASON_CODES)[keyof typeof REJECT_REASON_CODES];

export interface RejectApplicationInput {
  readonly applicationId: string;
  readonly version: number;
  readonly reasonCode: RejectReasonCode;
  readonly note: string;
}

export interface ApproveApplicationInput {
  readonly applicationId: string;
  readonly version: number;
}

export interface RequestDocumentsInput {
  readonly applicationId: string;
  readonly version: number;
  /** Echoed into the result: the wire's RequestDocumentsResult carries no applicant name. */
  readonly applicantName: string;
  /** What is still owed — derived from the record's missing/failed documents and blockers. */
  readonly documentTypeKeys: readonly DocumentTypeKey[];
}

export interface ApplicationDecisionResult {
  readonly applicationId: string;
  readonly applicantName: string;
}
