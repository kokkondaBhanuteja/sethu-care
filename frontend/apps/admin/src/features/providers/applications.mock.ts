// Applications pipeline fixtures (BOX 43–47, M69–M74). The queue is the artifact's, oldest first.
//
// Trigger ids for the designed states are listed in the feature CLAUDE.md: APP-4471 reviews
// cleanly, APP-4473 is approve-blocked by a missing document, APP-4460 was already decided.

import { mockRead, mockWrite } from "../../mocks/mockTransport";
import { APPLICATION_SEGMENTS, APPLICATION_STATUSES } from "./applications.types";
import type {
  ApplicationDecisionResult,
  ApplicationQueue,
  ApplicationRow,
  ApplicationSegment,
  ApplicationReview,
  RejectApplicationInput,
} from "./applications.types";
import { APPLICATION_IDS, APPLICATION_REVIEWS } from "./applicationFixtures";

const ROWS: readonly ApplicationRow[] = [
  {
    id: APPLICATION_IDS.reviewable,
    applicantName: "Ajay Verma",
    categories: ["Electrical", "AC Repair"],
    zone: "Miyapur",
    appliedAt: "2026-07-17T06:30:00Z",
    daysWaiting: 4,
    documentsPresent: 5,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.pending,
  },
  {
    id: "APP-4472",
    applicantName: "Lakshmi Reddy",
    categories: ["Plumbing"],
    zone: "Gachibowli",
    appliedAt: "2026-07-18T08:15:00Z",
    daysWaiting: 3,
    documentsPresent: 5,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.pending,
  },
  {
    id: APPLICATION_IDS.approveBlocked,
    applicantName: "Rahul Iyer",
    categories: ["AC Repair"],
    zone: "Kompally",
    appliedAt: "2026-07-20T10:05:00Z",
    daysWaiting: 1,
    documentsPresent: 4,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.awaitingDocs,
    awaitingDocumentKey: "document.policeVerification",
  },
  {
    id: APPLICATION_IDS.alreadyDecided,
    applicantName: "Vikram Naidu",
    categories: ["Plumbing", "Electrical"],
    zone: "Kompally",
    appliedAt: "2026-07-15T07:00:00Z",
    daysWaiting: null,
    documentsPresent: 5,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.approved,
    decidedAt: "2026-07-16T05:30:00Z",
  },
  {
    id: "APP-4455",
    applicantName: "Priya Nair",
    categories: ["AC Repair"],
    zone: "Madhapur",
    appliedAt: "2026-07-14T09:20:00Z",
    daysWaiting: null,
    documentsPresent: 5,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.approved,
    decidedAt: "2026-07-15T06:10:00Z",
  },
  {
    id: "APP-4450",
    applicantName: "Imran Qureshi",
    categories: ["Electrical"],
    zone: "Secunderabad",
    appliedAt: "2026-07-13T11:40:00Z",
    daysWaiting: null,
    documentsPresent: 3,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.rejected,
    decidedAt: "2026-07-14T04:55:00Z",
  },
  {
    id: "APP-4445",
    applicantName: "Deepa Rao",
    categories: ["Refrigerator"],
    zone: "Gachibowli",
    appliedAt: "2026-07-12T05:25:00Z",
    daysWaiting: null,
    documentsPresent: 5,
    documentsRequired: 5,
    status: APPLICATION_STATUSES.approved,
    decidedAt: "2026-07-13T08:00:00Z",
  },
];

const COUNTS = { pending: 2, awaitingDocs: 1, decided: 4 };
const EMPTY_QUEUE: ApplicationQueue = {
  rows: [],
  counts: { pending: 0, awaitingDocs: 0, decided: COUNTS.decided },
  oldestDays: 0,
};

const SEGMENT_STATUSES: Readonly<Record<ApplicationSegment, readonly string[]>> = {
  [APPLICATION_SEGMENTS.pending]: [APPLICATION_STATUSES.pending],
  [APPLICATION_SEGMENTS.awaitingDocs]: [APPLICATION_STATUSES.awaitingDocs],
  [APPLICATION_SEGMENTS.decided]: [APPLICATION_STATUSES.approved, APPLICATION_STATUSES.rejected],
};

/**
 * The desktop queue keeps decided rows visible under the live ones — they answer "did we already
 * look at this person?" without a second screen (BOX 43).
 */
export function fetchApplicationQueueMock(
  segment: ApplicationSegment,
  includeDecided: boolean,
  signal?: AbortSignal,
): Promise<ApplicationQueue> {
  return mockRead<ApplicationQueue>(
    () => {
      const wanted = SEGMENT_STATUSES[segment];
      const decided = SEGMENT_STATUSES[APPLICATION_SEGMENTS.decided];
      return {
        rows: ROWS.filter(
          (row) =>
            wanted.includes(row.status) ||
            (includeDecided &&
              segment === APPLICATION_SEGMENTS.pending &&
              decided.includes(row.status)),
        ),
        counts: COUNTS,
        oldestDays: 4,
      };
    },
    { ...(signal ? { signal } : {}), emptyValue: EMPTY_QUEUE },
  );
}

export function fetchApplicationReviewMock(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationReview | null> {
  return mockRead<ApplicationReview | null>(
    () => APPLICATION_REVIEWS.find((review) => review.id === applicationId) ?? null,
    { ...(signal ? { signal } : {}), emptyValue: null },
  );
}

function applicantName(applicationId: string): string {
  return ROWS.find((row) => row.id === applicationId)?.applicantName ?? applicationId;
}

export function decideApplicationMock(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  return mockWrite<ApplicationDecisionResult>(
    () => ({ applicationId, applicantName: applicantName(applicationId) }),
    { ...(signal ? { signal } : {}) },
  );
}

export function rejectApplicationMock(
  input: RejectApplicationInput,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  return decideApplicationMock(input.applicationId, signal);
}
