import { describe, expect, it } from "vitest";

import type {
  ApplicationReview as ApiApplicationReview,
  ApplicationRow as ApiApplicationRow,
} from "@sethu/api-client";

import {
  appendDecidedRows,
  mapApplicationQueue,
  mapApplicationReview,
  mapApplicationRow,
  sizeLabelFor,
} from "./applications.api.map";
import { outstandingDocumentKeys } from "./providers.api.requests";
import { DOCUMENT_TYPE_KEYS } from "./providers.types";

function row(overrides: Partial<ApiApplicationRow> = {}): ApiApplicationRow {
  return {
    id: "a1000000-0000-4000-8000-000000000001",
    applicantName: "Anand Joshi",
    categories: ["Electrical"],
    zone: "Miyapur",
    appliedAt: "2026-07-17T06:30:00Z",
    daysWaiting: 6,
    documentsPresent: 5,
    documentsRequired: 5,
    status: "pending",
    ...overrides,
  };
}

function review(overrides: Partial<ApiApplicationReview> = {}): ApiApplicationReview {
  return {
    id: "a1000000-0000-4000-8000-000000000002",
    applicantName: "Bhavna Rao",
    phone: "+919000000031",
    email: "bhavna@example.in",
    address: "Madhapur, Hyderabad",
    appliedAt: "2026-07-18T06:30:00Z",
    daysWaiting: 5,
    categories: [{ name: "Plumbing", yearsClaimed: 4 }],
    documents: [
      {
        id: "doc-1",
        type: "AADHAAR_CARD",
        validation: "validated",
        uploadedAt: "2026-07-18T06:31:00Z",
        sizeBytes: 838_860,
      },
      { id: "doc-2", type: "POLICE_VERIFICATION", validation: "missing" },
    ],
    documentsRequired: 5,
    backgroundClearedAt: null,
    priorApplications: 0,
    autoValidation: [{ id: "check-1", code: "EXPIRY", passed: true }],
    approvalBlockers: [
      { id: "blocker-1", code: "POLICE_VERIFICATION_PENDING", documentType: "POLICE_VERIFICATION" },
    ],
    version: 0,
    ...overrides,
  };
}

describe("mapApplicationRow", () => {
  it("maps the awaited document type onto the i18n vocabulary, only when present", () => {
    const awaiting = mapApplicationRow(
      row({ status: "awaiting_docs", awaitingDocumentType: "BANK_PASSBOOK" }),
    );
    expect(awaiting.awaitingDocumentKey).toBe(DOCUMENT_TYPE_KEYS.bankPassbook);
    expect(mapApplicationRow(row()).awaitingDocumentKey).toBeUndefined();
  });
});

describe("mapApplicationQueue / appendDecidedRows", () => {
  it("keeps the live segment's counts and SLA line when the decided tail is appended", () => {
    const pending = mapApplicationQueue({
      rows: [row()],
      counts: { pending: 1, awaitingDocs: 1, decided: 2 },
      oldestDays: 6,
    });
    const decided = mapApplicationQueue({
      rows: [row({ id: "a-2", status: "approved", daysWaiting: null, decidedAt: "2026-07-20" })],
      counts: { pending: 1, awaitingDocs: 1, decided: 2 },
      oldestDays: 6,
    });
    const merged = appendDecidedRows(pending, decided);
    expect(merged.rows.map((entry) => entry.status)).toEqual(["pending", "approved"]);
    expect(merged.oldestDays).toBe(6);
    expect(merged.counts.decided).toBe(2);
  });
});

describe("mapApplicationReview", () => {
  it("maps checks, blockers and document sizes onto the designed vocabularies", () => {
    const mapped = mapApplicationReview(review());
    expect(mapped.autoValidation[0]?.labelKey).toBe("review.checkExpiry");
    expect(mapped.approvalBlockers[0]?.messageKey).toBe("review.blockerPoliceVerification");
    expect(mapped.approvalBlockers[0]?.documentKey).toBe(DOCUMENT_TYPE_KEYS.policeVerification);
    expect(mapped.documents[0]?.sizeLabel).toBe("0.8 MB");
    expect(mapped.documents[1]?.sizeLabel).toBeUndefined();
    expect(mapped.decision).toBeUndefined();
  });

  it("carries the decision through for the already-decided record", () => {
    const mapped = mapApplicationReview(
      review({ decision: { outcome: "rejected", byName: "Priya", at: "2026-07-20T09:00:00Z" } }),
    );
    expect(mapped.decision).toEqual({
      outcome: "rejected",
      byName: "Priya",
      at: "2026-07-20T09:00:00Z",
    });
  });
});

describe("sizeLabelFor", () => {
  it("prints one-decimal megabytes, as the artifact does", () => {
    expect(sizeLabelFor(1_258_291)).toBe("1.2 MB");
  });
});

describe("outstandingDocumentKeys", () => {
  it("collects missing/failed documents plus blocker documents, without duplicates", () => {
    const keys = outstandingDocumentKeys(mapApplicationReview(review()));
    expect(keys).toEqual([DOCUMENT_TYPE_KEYS.policeVerification]);
  });

  it("is empty when every document validated and no blocker names one", () => {
    const clean = mapApplicationReview(
      review({
        documents: [{ id: "doc-1", type: "PAN", validation: "validated" }],
        approvalBlockers: [],
      }),
    );
    expect(outstandingDocumentKeys(clean)).toEqual([]);
  });
});
