// The ONLY boundary between the providers feature and its data.
//
// None of these endpoints exists on the backend yet — see docs/admin-api-contract.md,
// "MISSING — providers". Each function below is where the generated client's call replaces the
// mock, and nothing above this file changes when it does.

import { normalizeError } from "../../lib/http/apiError";
import { fetchProviderRosterMock, type RosterVariant } from "./providers.mock";
import { fetchProviderProfileMock } from "./providerProfiles.mock";
import {
  fetchProviderActiveJobsMock,
  restoreProviderMock,
  suspendProviderMock,
} from "./suspend.mock";
import {
  decideApplicationMock,
  fetchApplicationQueueMock,
  fetchApplicationReviewMock,
  rejectApplicationMock,
} from "./applications.mock";
import type { ProviderProfile, ProviderRoster, RosterSegment } from "./providers.types";
import type {
  ProviderActiveJob,
  SuspendProviderInput,
  SuspendProviderResult,
} from "./suspend.types";
import type {
  ApplicationDecisionResult,
  ApplicationQueue,
  ApplicationReview,
  ApplicationSegment,
  RejectApplicationInput,
} from "./applications.types";

export interface RosterRequest {
  readonly segment: RosterSegment;
  readonly search: string;
  readonly variant: RosterVariant;
}

/** `GET /ops/providers` */
export async function fetchProviderRoster(
  request: RosterRequest,
  signal?: AbortSignal,
): Promise<ProviderRoster> {
  try {
    return await fetchProviderRosterMock(request.segment, request.search, request.variant, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The provider roster could not be loaded.");
  }
}

/** `GET /ops/providers/{id}` — resolves to null when the id is unknown, never throws 404. */
export async function fetchProviderProfile(
  providerId: string,
  signal?: AbortSignal,
): Promise<ProviderProfile | null> {
  try {
    return await fetchProviderProfileMock(providerId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This provider could not be loaded.");
  }
}

/** `GET /ops/providers/{id}/active-jobs` — step 3 of the suspend flow. */
export async function fetchProviderActiveJobs(
  providerId: string,
  signal?: AbortSignal,
): Promise<readonly ProviderActiveJob[]> {
  try {
    return await fetchProviderActiveJobsMock(providerId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This provider's active jobs could not be loaded.");
  }
}

/** `POST /ops/providers/{id}/suspend` · `/block` · `/force-offline` — one payload, typed by `type`. */
export async function suspendProvider(
  input: SuspendProviderInput,
  signal?: AbortSignal,
): Promise<SuspendProviderResult> {
  try {
    return await suspendProviderMock(input, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The suspension could not be applied.");
  }
}

/** `POST /ops/providers/{id}/restore` */
export async function restoreProvider(
  providerId: string,
  signal?: AbortSignal,
): Promise<{ providerId: string }> {
  try {
    return await restoreProviderMock(providerId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This provider could not be restored.");
  }
}

export interface ApplicationQueueRequest {
  readonly segment: ApplicationSegment;
  /** Desktop keeps decided rows under the live ones; mobile does not (BOX 43 vs M69). */
  readonly includeDecided: boolean;
}

/** `GET /ops/applications` */
export async function fetchApplicationQueue(
  request: ApplicationQueueRequest,
  signal?: AbortSignal,
): Promise<ApplicationQueue> {
  try {
    return await fetchApplicationQueueMock(request.segment, request.includeDecided, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The applications queue could not be loaded.");
  }
}

/** `GET /ops/applications/{id}` */
export async function fetchApplicationReview(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationReview | null> {
  try {
    return await fetchApplicationReviewMock(applicationId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This application could not be loaded.");
  }
}

/** `POST /ops/applications/{id}/approve` */
export async function approveApplication(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  try {
    return await decideApplicationMock(applicationId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This application could not be approved.");
  }
}

/** `POST /ops/applications/{id}/reject` */
export async function rejectApplication(
  input: RejectApplicationInput,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  try {
    return await rejectApplicationMock(input, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This application could not be rejected.");
  }
}

/** `POST /ops/applications/{id}/request-documents` */
export async function requestApplicationDocuments(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationDecisionResult> {
  try {
    return await decideApplicationMock(applicationId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The document request could not be sent.");
  }
}
