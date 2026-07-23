// The data boundary for the application pipeline (queue, review, approve / reject /
// request-documents). The provider side's boundary is `providers.api.ts`; the two files share the
// unwrap seam, the mappers and the request builders.
//
// Live endpoints (backend internal/providerops): reads are sdk call → pure mapper → feature
// types; every decision sends an `Idempotency-Key` header plus the CAS `version` the operator
// read. 409 ALREADY_DECIDED and VERSION_CONFLICT surface as `conflict` ApiErrors with curated
// sentences — the mutation hooks re-read the record, which renders the designed banner. The mock
// branch is untouched.

import {
  opsApproveApplication,
  opsGetApplication,
  opsListApplications,
  opsRejectApplication,
  opsRequestApplicationDocuments,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  APPROVE_STATUS_FAILURES,
  FAILURE,
  REJECT_STATUS_FAILURES,
  REQUEST_DOCUMENTS_STATUS_FAILURES,
  unwrap,
} from "./providers.api.errors";
import {
  appendDecidedRows,
  mapApplicationQueue,
  mapApplicationReview,
  mapDecisionResult,
  toListApplicationsParams,
} from "./applications.api.map";
import {
  newIdempotencyKey,
  toApproveApplicationRequest,
  toRejectApplicationRequest,
  toRequestDocumentsRequest,
} from "./providers.api.requests";
import {
  decideApplicationMock,
  fetchApplicationQueueMock,
  fetchApplicationReviewMock,
  rejectApplicationMock,
} from "./applications.mock";
import { APPLICATION_SEGMENTS } from "./applications.types";
import type {
  ApplicationDecisionResult,
  ApplicationQueue,
  ApplicationReview,
  ApplicationSegment,
  ApproveApplicationInput,
  RejectApplicationInput,
  RequestDocumentsInput,
} from "./applications.types";

/** Everything thrown at this boundary leaves as an ApiError — declared bodies via unwrap. */
async function call<TResult>(run: () => Promise<TResult>, failure: string): Promise<TResult> {
  try {
    return await run();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

const NOT_FOUND = 404;

export interface ApplicationQueueRequest {
  readonly segment: ApplicationSegment;
  /** Desktop keeps decided rows under the live ones; mobile does not (BOX 43 vs M69). */
  readonly includeDecided: boolean;
}

/**
 * `GET /ops/applications`. The server serves one segment per request, so the desktop's
 * decided-under-pending view is two reads merged — the counts and SLA line come from the live one.
 */
export function fetchApplicationQueue(
  request: ApplicationQueueRequest,
  signal?: AbortSignal,
): Promise<ApplicationQueue> {
  return call(async () => {
    if (env.useMocks) {
      return fetchApplicationQueueMock(request.segment, request.includeDecided, signal);
    }
    const wantsDecidedTail =
      request.includeDecided && request.segment === APPLICATION_SEGMENTS.pending;
    const [segmentResult, decidedResult] = await Promise.all([
      opsListApplications({ query: toListApplicationsParams(request.segment), signal }),
      wantsDecidedTail
        ? opsListApplications({
            query: toListApplicationsParams(APPLICATION_SEGMENTS.decided),
            signal,
          })
        : Promise.resolve(null),
    ]);
    const queue = mapApplicationQueue(unwrap(segmentResult, FAILURE.queue));
    if (decidedResult === null) return queue;
    return appendDecidedRows(queue, mapApplicationQueue(unwrap(decidedResult, FAILURE.queue)));
  }, FAILURE.queue);
}

/** `GET /ops/applications/{id}` — resolves to null when the id is unknown, never throws 404. */
export function fetchApplicationReview(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationReview | null> {
  return call(async () => {
    if (env.useMocks) return fetchApplicationReviewMock(applicationId, signal);
    const result = await opsGetApplication({ path: { id: applicationId }, signal });
    if (result.response?.status === NOT_FOUND) return null;
    return mapApplicationReview(unwrap(result, FAILURE.review));
  }, FAILURE.review);
}

/** `POST /ops/applications/{id}/approve` — the gate is SERVER-computed; a 422 means blockers. */
export function approveApplication(
  input: ApproveApplicationInput,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  return call(async () => {
    if (env.useMocks) return decideApplicationMock(input.applicationId, signal);
    const result = await opsApproveApplication({
      path: { id: input.applicationId },
      headers: { "Idempotency-Key": newIdempotencyKey() },
      body: toApproveApplicationRequest(input.version),
    });
    return mapDecisionResult(unwrap(result, FAILURE.approve, APPROVE_STATUS_FAILURES));
  }, FAILURE.approve);
}

/** `POST /ops/applications/{id}/reject` — the 20-character note floor is server-enforced (422). */
export function rejectApplication(
  input: RejectApplicationInput,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  return call(async () => {
    if (env.useMocks) return rejectApplicationMock(input, signal);
    const result = await opsRejectApplication({
      path: { id: input.applicationId },
      headers: { "Idempotency-Key": newIdempotencyKey() },
      body: toRejectApplicationRequest(input),
    });
    return mapDecisionResult(unwrap(result, FAILURE.reject, REJECT_STATUS_FAILURES));
  }, FAILURE.reject);
}

/**
 * `POST /ops/applications/{id}/request-documents`. The result echoes the input's applicant name:
 * the wire's RequestDocumentsResult carries none, and the success toast prints it.
 */
export function requestApplicationDocuments(
  input: RequestDocumentsInput,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  return call(async () => {
    if (env.useMocks) return decideApplicationMock(input.applicationId, signal);
    const result = await opsRequestApplicationDocuments({
      path: { id: input.applicationId },
      headers: { "Idempotency-Key": newIdempotencyKey() },
      body: toRequestDocumentsRequest(input),
    });
    const payload = unwrap(result, FAILURE.requestDocuments, REQUEST_DOCUMENTS_STATUS_FAILURES);
    return { applicationId: payload.applicationId, applicantName: input.applicantName };
  }, FAILURE.requestDocuments);
}
