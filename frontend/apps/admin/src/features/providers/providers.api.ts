// The data boundary for the provider side of this feature (roster, profile, active jobs and the
// suspend / block / force-offline / restore family). The application pipeline's boundary is
// `applications.api.ts`; no other file in this feature touches the client or a mock.
//
// The providerops endpoints are REAL (backend internal/providerops): with mocks off, every read
// is sdk call → pure mapper → feature types, and every mutation sends an `Idempotency-Key` header
// plus the standing-row CAS `version` the operator read. The mock branch is untouched, so unit
// tests and the designed-state walks behave exactly as before — nothing above this file changed.

import {
  opsBlockProvider,
  opsForceProviderOffline,
  opsGetProvider,
  opsListProviders,
  opsProviderActiveJobs,
  opsRestoreProvider,
  opsSuspendProvider,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  FAILURE,
  RESTORE_STATUS_FAILURES,
  SUSPEND_STATUS_FAILURES,
  unwrap,
} from "./providers.api.errors";
import {
  mapProviderActiveJob,
  mapProviderProfile,
  mapProviderRoster,
  toListProvidersParams,
} from "./providers.api.map";
import {
  newIdempotencyKey,
  toRestoreProviderRequest,
  toSuspendProviderRequest,
} from "./providers.api.requests";
import { fetchProviderRosterMock, type RosterVariant } from "./providers.mock";
import { fetchProviderProfileMock } from "./providerProfiles.mock";
import {
  fetchProviderActiveJobsMock,
  restoreProviderMock,
  suspendProviderMock,
} from "./suspend.mock";
import type { ProviderProfile, ProviderRoster, RosterSegment } from "./providers.types";
import { SUSPEND_ACTION_TYPES } from "./suspend.types";
import type {
  ProviderActiveJob,
  RestoreProviderInput,
  SuspendProviderInput,
  SuspendProviderResult,
} from "./suspend.types";

/** Everything thrown at this boundary leaves as an ApiError — declared bodies via unwrap. */
async function call<TResult>(run: () => Promise<TResult>, failure: string): Promise<TResult> {
  try {
    return await run();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

const NOT_FOUND = 404;

export interface RosterRequest {
  readonly segment: RosterSegment;
  readonly search: string;
  /** Mock-only designed-state switch (`?state=healthy|stale`); the live roster ignores it. */
  readonly variant: RosterVariant;
}

/** `GET /ops/providers` */
export function fetchProviderRoster(
  request: RosterRequest,
  signal?: AbortSignal,
): Promise<ProviderRoster> {
  return call(async () => {
    if (env.useMocks) {
      return fetchProviderRosterMock(request.segment, request.search, request.variant, signal);
    }
    const result = await opsListProviders({ query: toListProvidersParams(request), signal });
    return mapProviderRoster(unwrap(result, FAILURE.roster));
  }, FAILURE.roster);
}

/** `GET /ops/providers/{id}` — resolves to null when the id is unknown, never throws 404. */
export function fetchProviderProfile(
  providerId: string,
  signal?: AbortSignal,
): Promise<ProviderProfile | null> {
  return call(async () => {
    if (env.useMocks) return fetchProviderProfileMock(providerId, signal);
    const result = await opsGetProvider({ path: { id: providerId }, signal });
    if (result.response?.status === NOT_FOUND) return null;
    return mapProviderProfile(unwrap(result, FAILURE.profile));
  }, FAILURE.profile);
}

/** `GET /ops/providers/{id}/active-jobs` — step 3 of the suspend flow. */
export function fetchProviderActiveJobs(
  providerId: string,
  signal?: AbortSignal,
): Promise<readonly ProviderActiveJob[]> {
  return call(async () => {
    if (env.useMocks) return fetchProviderActiveJobsMock(providerId, signal);
    const result = await opsProviderActiveJobs({ path: { id: providerId }, signal });
    return unwrap(result, FAILURE.activeJobs).items.map(mapProviderActiveJob);
  }, FAILURE.activeJobs);
}

/**
 * `POST /ops/providers/{id}/suspend` · `/block` · `/force-offline` — one payload family; the
 * input's `type` picks the endpoint AND rides in the body (the server 400s on a mismatch).
 * A live job left unresolved is the server's 422, curated in providers.api.errors.ts.
 */
export function suspendProvider(
  input: SuspendProviderInput,
  signal?: AbortSignal,
): Promise<SuspendProviderResult> {
  return call(async () => {
    if (env.useMocks) return suspendProviderMock(input, signal);
    const options = {
      path: { id: input.providerId },
      headers: { "Idempotency-Key": newIdempotencyKey() },
      body: toSuspendProviderRequest(input),
    };
    const result =
      input.type === SUSPEND_ACTION_TYPES.block
        ? await opsBlockProvider(options)
        : input.type === SUSPEND_ACTION_TYPES.forceOffline
          ? await opsForceProviderOffline(options)
          : await opsSuspendProvider(options);
    const payload = unwrap(result, FAILURE.suspend, SUSPEND_STATUS_FAILURES);
    return {
      providerId: payload.providerId,
      type: payload.type,
      durationDays: payload.durationDays,
      effectiveUntil: payload.effectiveUntil,
      ...(payload.version !== undefined ? { version: payload.version } : {}),
    };
  }, FAILURE.suspend);
}

/** `POST /ops/providers/{id}/restore` — reverses a suspension or a block, same CAS guard. */
export function restoreProvider(
  input: RestoreProviderInput,
  signal?: AbortSignal,
): Promise<{ providerId: string }> {
  return call(async () => {
    if (env.useMocks) return restoreProviderMock(input.providerId, signal);
    const result = await opsRestoreProvider({
      path: { id: input.providerId },
      headers: { "Idempotency-Key": newIdempotencyKey() },
      body: toRestoreProviderRequest(input),
    });
    return { providerId: unwrap(result, FAILURE.restore, RESTORE_STATUS_FAILURES).providerId };
  }, FAILURE.restore);
}
