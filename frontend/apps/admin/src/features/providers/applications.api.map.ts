// Pure mappers from the generated /ops/applications payloads (@sethu/api-client) onto this
// feature's normative shapes in applications.types.ts. Field-by-field on purpose — drift is a
// compile error here, not a rendering surprise.

import type {
  ApplicationDecision as ApiApplicationDecision,
  ApplicationDocument as ApiApplicationDocument,
  ApplicationQueue as ApiApplicationQueue,
  ApplicationReview as ApiApplicationReview,
  ApplicationRow as ApiApplicationRow,
  ApprovalBlocker as ApiApprovalBlocker,
  ApplicationDecisionResult as ApiApplicationDecisionResult,
  AutoCheckCode as ApiAutoCheckCode,
  ApprovalBlockerCode as ApiApprovalBlockerCode,
  AutoValidationCheck as ApiAutoValidationCheck,
} from "@sethu/api-client";

import { AUTO_CHECK_LABEL_KEYS, BLOCKER_MESSAGE_KEYS } from "./applications.types";
import type {
  ApplicationDecision,
  ApplicationDecisionResult,
  ApplicationDocument,
  ApplicationQueue,
  ApplicationReview,
  ApplicationRow,
  ApplicationSegment,
  ApprovalBlocker,
  AutoCheckLabelKey,
  AutoValidationCheck,
  BlockerMessageKey,
} from "./applications.types";
import { documentTypeKeyFor } from "./providers.api.map";

/** The server caps page size at 100; the queue has no pager, so one full page is fetched. */
export const APPLICATIONS_FETCH_CAP = 100;

export interface ListApplicationsParams {
  readonly segment: ApplicationSegment;
  readonly limit: number;
}

export function toListApplicationsParams(segment: ApplicationSegment): ListApplicationsParams {
  return { segment, limit: APPLICATIONS_FETCH_CAP };
}

export function mapApplicationRow(row: ApiApplicationRow): ApplicationRow {
  return {
    id: row.id,
    applicantName: row.applicantName,
    categories: [...row.categories],
    zone: row.zone,
    appliedAt: row.appliedAt,
    daysWaiting: row.daysWaiting,
    documentsPresent: row.documentsPresent,
    documentsRequired: row.documentsRequired,
    status: row.status,
    ...(row.awaitingDocumentType !== undefined
      ? { awaitingDocumentKey: documentTypeKeyFor(row.awaitingDocumentType) }
      : {}),
    ...(row.decidedAt !== undefined ? { decidedAt: row.decidedAt } : {}),
  };
}

export function mapApplicationQueue(payload: ApiApplicationQueue): ApplicationQueue {
  return {
    rows: payload.rows.map(mapApplicationRow),
    counts: {
      pending: payload.counts.pending,
      awaitingDocs: payload.counts.awaitingDocs,
      decided: payload.counts.decided,
    },
    oldestDays: payload.oldestDays,
  };
}

/**
 * The desktop pending queue keeps decided rows visible under the live ones (BOX 43). The server
 * serves one segment per request, so real mode appends a decided page after the live one.
 */
export function appendDecidedRows(
  queue: ApplicationQueue,
  decided: ApplicationQueue,
): ApplicationQueue {
  return { ...queue, rows: [...queue.rows, ...decided.rows] };
}

const BYTES_PER_MB = 1024 * 1024;

/** "0.8 MB", as the artifact prints it. Promotion candidate for lib/format on a second consumer. */
export function sizeLabelFor(sizeBytes: number): string {
  return `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`;
}

// The generated document also carries `url` (the scan itself). The feature shape has no slot for
// it yet — the desktop viewer draws its placeholder geometry — so the scan is not rendered.
// Flagged in the feature CLAUDE.md rather than worked around.
export function mapApplicationDocument(document: ApiApplicationDocument): ApplicationDocument {
  return {
    id: document.id,
    typeKey: documentTypeKeyFor(document.type),
    validation: document.validation,
    ...(document.uploadedAt !== undefined ? { uploadedAt: document.uploadedAt } : {}),
    ...(document.expiresAt !== undefined ? { expiresAt: document.expiresAt } : {}),
    ...(document.detail !== undefined ? { detail: document.detail } : {}),
    ...(document.sizeBytes !== undefined ? { sizeLabel: sizeLabelFor(document.sizeBytes) } : {}),
    ...(document.ocrRead !== undefined ? { ocrRead: document.ocrRead } : {}),
    ...(document.ocrExpected !== undefined ? { ocrExpected: document.ocrExpected } : {}),
    ...(document.pageLineWidths !== undefined
      ? { pageLineWidths: [...document.pageLineWidths] }
      : {}),
    ...(document.pageHeading !== undefined ? { pageHeading: document.pageHeading } : {}),
    ...(document.pageNameLine !== undefined ? { pageNameLine: document.pageNameLine } : {}),
  };
}

/** Wire check codes → the fixed label vocabulary. BLUR never arrives today (no image analysis). */
const AUTO_CHECK_KEY_FOR: Readonly<Record<ApiAutoCheckCode, AutoCheckLabelKey>> = {
  EXPIRY: AUTO_CHECK_LABEL_KEYS.expiry,
  BLUR: AUTO_CHECK_LABEL_KEYS.blur,
  OCR: AUTO_CHECK_LABEL_KEYS.ocr,
};

export function mapAutoValidationCheck(check: ApiAutoValidationCheck): AutoValidationCheck {
  return {
    id: check.id,
    labelKey: AUTO_CHECK_KEY_FOR[check.code],
    passed: check.passed,
    ...(check.detail !== undefined ? { detail: check.detail } : {}),
  };
}

/** SERVER-computed blockers → the message-key vocabulary next to the dead Approve (BOX 47). */
const BLOCKER_KEY_FOR: Readonly<Record<ApiApprovalBlockerCode, BlockerMessageKey>> = {
  POLICE_VERIFICATION_PENDING: BLOCKER_MESSAGE_KEYS.policeVerification,
  MISSING_DOCUMENT: BLOCKER_MESSAGE_KEYS.missingDocument,
  EXPIRED_DOCUMENT: BLOCKER_MESSAGE_KEYS.expiredDocument,
};

export function mapApprovalBlocker(blocker: ApiApprovalBlocker): ApprovalBlocker {
  return {
    id: blocker.id,
    messageKey: BLOCKER_KEY_FOR[blocker.code],
    ...(blocker.documentType !== undefined
      ? { documentKey: documentTypeKeyFor(blocker.documentType) }
      : {}),
  };
}

function mapDecision(decision: ApiApplicationDecision): ApplicationDecision {
  return { outcome: decision.outcome, byName: decision.byName, at: decision.at };
}

export function mapApplicationReview(payload: ApiApplicationReview): ApplicationReview {
  return {
    id: payload.id,
    applicantName: payload.applicantName,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    appliedAt: payload.appliedAt,
    daysWaiting: payload.daysWaiting,
    categories: payload.categories.map((category) => ({
      name: category.name,
      yearsClaimed: category.yearsClaimed,
    })),
    documents: payload.documents.map(mapApplicationDocument),
    documentsRequired: payload.documentsRequired,
    backgroundClearedAt: payload.backgroundClearedAt,
    priorApplications: payload.priorApplications,
    autoValidation: payload.autoValidation.map(mapAutoValidationCheck),
    approvalBlockers: payload.approvalBlockers.map(mapApprovalBlocker),
    ...(payload.decision !== undefined ? { decision: mapDecision(payload.decision) } : {}),
    version: payload.version,
  };
}

export function mapDecisionResult(
  payload: ApiApplicationDecisionResult,
): ApplicationDecisionResult {
  return { applicationId: payload.applicationId, applicantName: payload.applicantName };
}
