// Feature mutation payloads → the generated request bodies, copied field by field so a contract
// drift is a compile error here (the mirror of the *.api.map.ts files, which map responses).
//
// The `Idempotency-Key` never rides in a body: it travels as a HEADER, attached in the api files.
// `version` appears in every body — the standing-row CAS token the operator read (0 when the
// record was never acted on); a stale one is the server's 409 VERSION_CONFLICT.

import type {
  DocumentType as ApiDocumentType,
  ApproveApplicationRequest,
  RejectApplicationRequest,
  RequestDocumentsRequest,
  RestoreProviderRequest,
  SuspendProviderRequest,
} from "@sethu/api-client";

import { DOCUMENT_VALIDATIONS } from "./applications.types";
import type {
  ApplicationReview,
  RejectApplicationInput,
  RequestDocumentsInput,
} from "./applications.types";
import { DOCUMENT_TYPE_KEYS } from "./providers.types";
import type { DocumentTypeKey } from "./providers.types";
import { JOB_RESOLUTIONS } from "./suspend.types";
import type { JobResolution, RestoreProviderInput, SuspendProviderInput } from "./suspend.types";

/**
 * One key per mutation call. Mutations never retry (lib/query/queryClient.ts) and every commit
 * button is in-flight-guarded, so a call is an operator intent in practice. Booking-actions'
 * per-intent `useIdempotencyKey` is the stricter form — promoting it to `src/hooks` and threading
 * keys through these inputs is the owed follow-up (it cannot be imported across features).
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews without randomUUID still need a key; the backend scopes it per admin + op.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The flow's resolution map allows `undefined` for "still unresolved"; the wire shape does not.
 * Undecided entries are stripped rather than defaulted — the server's unresolved-job 422 is the
 * honest answer if one slips through.
 */
export function toWireJobResolutions(
  jobResolutions: SuspendProviderInput["jobResolutions"],
): Record<string, JobResolution> {
  const resolved: Record<string, JobResolution> = {};
  for (const [bookingId, resolution] of Object.entries(jobResolutions)) {
    if (resolution === JOB_RESOLUTIONS.reassign || resolution === JOB_RESOLUTIONS.letFinish) {
      resolved[bookingId] = resolution;
    }
  }
  return resolved;
}

/** One body serves suspend, block and force-offline; `type` must match the endpoint (400 else). */
export function toSuspendProviderRequest(input: SuspendProviderInput): SuspendProviderRequest {
  return {
    version: input.version,
    type: input.type,
    durationDays: input.durationDays,
    reasonCode: input.reasonCode,
    note: input.note,
    jobResolutions: toWireJobResolutions(input.jobResolutions),
    notifyImmediately: input.notifyImmediately,
  };
}

export function toRestoreProviderRequest(input: RestoreProviderInput): RestoreProviderRequest {
  return { version: input.version };
}

export function toApproveApplicationRequest(version: number): ApproveApplicationRequest {
  return { version };
}

export function toRejectApplicationRequest(
  input: RejectApplicationInput,
): RejectApplicationRequest {
  return { version: input.version, reasonCode: input.reasonCode, note: input.note };
}

/** The reverse of providers.api.map.ts's documentTypeKeyFor — request bodies carry wire codes. */
const DOCUMENT_TYPE_FOR_KEY: Readonly<Record<DocumentTypeKey, ApiDocumentType>> = {
  [DOCUMENT_TYPE_KEYS.aadhaar]: "AADHAAR",
  [DOCUMENT_TYPE_KEYS.aadhaarCard]: "AADHAAR_CARD",
  [DOCUMENT_TYPE_KEYS.pan]: "PAN",
  [DOCUMENT_TYPE_KEYS.drivingLicence]: "DRIVING_LICENCE",
  [DOCUMENT_TYPE_KEYS.skillCertificate]: "SKILL_CERTIFICATE",
  [DOCUMENT_TYPE_KEYS.electricalCertificate]: "ELECTRICAL_CERTIFICATE",
  [DOCUMENT_TYPE_KEYS.policeVerification]: "POLICE_VERIFICATION",
  [DOCUMENT_TYPE_KEYS.bankPassbook]: "BANK_PASSBOOK",
  [DOCUMENT_TYPE_KEYS.bankDetails]: "BANK_DETAILS",
};

export function toRequestDocumentsRequest(input: RequestDocumentsInput): RequestDocumentsRequest {
  return {
    version: input.version,
    documentTypes: input.documentTypeKeys.map((key) => DOCUMENT_TYPE_FOR_KEY[key]),
  };
}

/**
 * What the applicant still owes: the record's missing/failed documents plus any blocker's named
 * document. Derived, never chosen in a screen — the server re-validates and 422s an empty request.
 */
export function outstandingDocumentKeys(review: ApplicationReview): readonly DocumentTypeKey[] {
  const keys = review.documents
    .filter((document) => document.validation !== DOCUMENT_VALIDATIONS.validated)
    .map((document) => document.typeKey);
  for (const blocker of review.approvalBlockers) {
    if (blocker.documentKey !== undefined && !keys.includes(blocker.documentKey)) {
      keys.push(blocker.documentKey);
    }
  }
  return keys;
}
