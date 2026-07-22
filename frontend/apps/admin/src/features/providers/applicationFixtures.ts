// Application review records (BOX 45–47, M71–M74).
//
// The document "pages" are drawn from `pageLineWidths`, never fetched: the desktop viewer has to
// hold with zero network, and the OCR name line is spelled the way the mock says it was read so
// the auto-validation verdict underneath is checkable by eye.

import { APPLICATION_STATUSES, DOCUMENT_VALIDATIONS } from "./applications.types";
import type { ApplicationDocument, ApplicationReview } from "./applications.types";
import type { DocumentTypeKey } from "./providers.types";

export const APPLICATION_IDS = {
  reviewable: "APP-4471",
  approveBlocked: "APP-4473",
  alreadyDecided: "APP-4460",
} as const;

function validated(
  id: string,
  typeKey: DocumentTypeKey,
  extra: Partial<ApplicationDocument> = {},
): ApplicationDocument {
  return {
    id,
    typeKey,
    validation: DOCUMENT_VALIDATIONS.validated,
    uploadedAt: "2026-07-17T06:30:00Z",
    sizeLabel: "0.8 MB",
    pageLineWidths: [60, 100, 88, 74, 100, 92, 46],
    ...extra,
  };
}

const POLICE_VERIFICATION_FAILED: ApplicationDocument = {
  id: "doc-police",
  typeKey: "document.policeVerification",
  validation: DOCUMENT_VALIDATIONS.failed,
  uploadedAt: "2026-07-17T06:30:00Z",
  sizeLabel: "1.2 MB",
  ocrRead: "A. Verma",
  ocrExpected: "Ajay Verma",
  pageHeading: "Police verification certificate",
  pageNameLine: "Name: A. VERMA",
  pageLineWidths: [60, 100, 88, 74, 100, 92, 46, 40],
};

const AJAY_DOCUMENTS: readonly ApplicationDocument[] = [
  validated("doc-aadhaar", "document.aadhaarCard"),
  validated("doc-licence", "document.drivingLicence", { expiresAt: "2029-09-30T00:00:00Z" }),
  validated("doc-electrical", "document.electricalCertificate", {
    expiresAt: "2028-06-30T00:00:00Z",
  }),
  validated("doc-bank", "document.bankDetails", { detail: "HDFC ····8821" }),
  POLICE_VERIFICATION_FAILED,
];

const AJAY_REVIEW: ApplicationReview = {
  id: APPLICATION_IDS.reviewable,
  applicantName: "Ajay Verma",
  phone: "+919812345678",
  email: "ajay.verma@gmail.com",
  address: "Miyapur, Hyderabad",
  appliedAt: "2026-07-17T06:30:00Z",
  daysWaiting: 4,
  categories: [
    { name: "Electrical", yearsClaimed: 6 },
    { name: "AC Repair", yearsClaimed: 3 },
  ],
  documents: AJAY_DOCUMENTS,
  documentsRequired: 5,
  backgroundClearedAt: "2026-07-19T05:00:00Z",
  priorApplications: 0,
  autoValidation: [
    { id: "check-expiry", labelKey: "review.checkExpiry", passed: true },
    { id: "check-blur", labelKey: "review.checkBlur", passed: true },
    {
      id: "check-ocr",
      labelKey: "review.checkOcr",
      passed: false,
      detail: "read “A. Verma”, expected “Ajay Verma”",
    },
  ],
  // Empty: the OCR mismatch is a warning the reviewer has not yet acted on, not a server gate.
  approvalBlockers: [],
  version: 3,
};

const RAHUL_REVIEW: ApplicationReview = {
  id: APPLICATION_IDS.approveBlocked,
  applicantName: "Rahul Iyer",
  phone: "+919845012233",
  email: "rahul.iyer@gmail.com",
  address: "Kompally, Hyderabad",
  appliedAt: "2026-07-20T10:05:00Z",
  daysWaiting: 1,
  categories: [{ name: "AC Repair", yearsClaimed: 4 }],
  documents: [
    validated("doc-aadhaar", "document.aadhaarCard"),
    validated("doc-licence", "document.drivingLicence", { expiresAt: "2030-01-31T00:00:00Z" }),
    validated("doc-skill", "document.skillCertificate", { expiresAt: "2027-11-30T00:00:00Z" }),
    validated("doc-bank", "document.bankDetails", { detail: "SBI ····4402" }),
    {
      id: "doc-police",
      typeKey: "document.policeVerification",
      validation: DOCUMENT_VALIDATIONS.missing,
    },
  ],
  documentsRequired: 5,
  backgroundClearedAt: null,
  priorApplications: 0,
  autoValidation: [
    { id: "check-expiry", labelKey: "review.checkExpiry", passed: true },
    { id: "check-blur", labelKey: "review.checkBlur", passed: true },
  ],
  // Server-enforced: approval is refused while a mandatory document is missing (spec §6.18).
  approvalBlockers: [
    { id: "blocker-police", messageKey: "review.blockerPoliceVerification" },
  ],
  version: 1,
};

const VIKRAM_REVIEW: ApplicationReview = {
  id: APPLICATION_IDS.alreadyDecided,
  applicantName: "Vikram Naidu",
  phone: "+919701122334",
  email: "vikram.naidu@gmail.com",
  address: "Kompally, Hyderabad",
  appliedAt: "2026-07-15T07:00:00Z",
  daysWaiting: null,
  categories: [
    { name: "Plumbing", yearsClaimed: 8 },
    { name: "Electrical", yearsClaimed: 5 },
  ],
  documents: [
    validated("doc-aadhaar", "document.aadhaarCard"),
    validated("doc-licence", "document.drivingLicence", { expiresAt: "2031-04-30T00:00:00Z" }),
    validated("doc-skill", "document.skillCertificate", { expiresAt: "2028-02-28T00:00:00Z" }),
    validated("doc-bank", "document.bankDetails", { detail: "ICICI ····2091" }),
    validated("doc-police", "document.policeVerification"),
  ],
  documentsRequired: 5,
  backgroundClearedAt: "2026-07-16T04:00:00Z",
  priorApplications: 1,
  autoValidation: [
    { id: "check-expiry", labelKey: "review.checkExpiry", passed: true },
    { id: "check-blur", labelKey: "review.checkBlur", passed: true },
    { id: "check-ocr", labelKey: "review.checkOcr", passed: true },
  ],
  approvalBlockers: [],
  decision: {
    outcome: APPLICATION_STATUSES.approved,
    byName: "Priya Sharma",
    at: "2026-07-19T05:34:00Z",
  },
  version: 5,
};

export const APPLICATION_REVIEWS: readonly ApplicationReview[] = [
  AJAY_REVIEW,
  RAHUL_REVIEW,
  VIKRAM_REVIEW,
];
