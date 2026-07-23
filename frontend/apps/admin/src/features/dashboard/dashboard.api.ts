import {
  opsAcknowledgeAlert,
  opsActivityFeed,
  opsDashboardAttention,
  opsDashboardBand,
  opsDashboardSummary,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  ATTENTION_FETCH_CAP,
  mapActivityFeed,
  mapAlertBand,
  mapAttentionQueue,
  mapDashboardSummary,
  toServerAttentionFilter,
} from "./dashboard.api.map";
import {
  acknowledgeAlertMock,
  fetchActivityMock,
  fetchAlertBandMock,
  fetchAttentionQueueMock,
  fetchDashboardSummaryMock,
} from "./dashboard.mock";
import type {
  ActivityEntry,
  AlertBandState,
  AttentionFilter,
  AttentionQueue,
  DashboardPeriod,
  DashboardSummary,
} from "./dashboard.types";

// The one boundary between the dashboard screens and their data.
//
// All five calls are real and served through the generated client when mocks are off; the mock
// branch is untouched so unit tests and e2e runs behave exactly as before.

export async function fetchDashboardSummary(
  period: DashboardPeriod,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  try {
    if (env.useMocks) return await fetchDashboardSummaryMock(period, signal);

    const result = await opsDashboardSummary({ query: { period }, signal });
    if (result.data === undefined) throw result.response;
    return mapDashboardSummary(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "Today's figures could not be loaded.");
  }
}

export async function fetchAlertBand(signal?: AbortSignal): Promise<AlertBandState> {
  try {
    if (env.useMocks) return await fetchAlertBandMock(signal);

    const result = await opsDashboardBand({ signal });
    if (result.data === undefined) throw result.response;
    return mapAlertBand(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "The escalation band could not be loaded.");
  }
}

export async function fetchAttentionQueue(
  filter: AttentionFilter,
  limit: number | null,
  signal?: AbortSignal,
): Promise<AttentionQueue> {
  try {
    if (env.useMocks) return await fetchAttentionQueueMock(filter, limit, signal);

    const result = await opsDashboardAttention({
      query: {
        filter: toServerAttentionFilter(filter),
        // `null` means "the whole queue" (the feed pages client-side); the server caps at 100.
        limit: limit ?? ATTENTION_FETCH_CAP,
      },
      signal,
    });
    if (result.data === undefined) throw result.response;
    return mapAttentionQueue(result.data, filter);
  } catch (thrown) {
    throw normalizeError(thrown, "The attention queue could not be loaded.");
  }
}

export async function fetchActivity(
  limit: number,
  signal?: AbortSignal,
): Promise<readonly ActivityEntry[]> {
  try {
    if (env.useMocks) return await fetchActivityMock(limit, signal);

    const result = await opsActivityFeed({ query: { limit }, signal });
    if (result.data === undefined) throw result.response;
    return mapActivityFeed(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "Recent activity could not be loaded.");
  }
}

/**
 * One key per operator intent — and every call below is one intent: this mutation never
 * auto-retries, and acknowledgement is additionally idempotent per ALERT server-side
 * (first-writer-wins), so a fresh key per call cannot double-acknowledge.
 */
function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews without randomUUID still need a key; the backend scopes it per admin + endpoint.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * `POST /ops/alerts/{id}/acknowledge`. The queue hands this a booking-scoped alert id and the
 * backend resolves it to that subject's newest alert — both id kinds land on the same receipt.
 * A late acknowledger still gets HTTP 200 with the winner's receipt (first-writer-wins); the row
 * flips to its acknowledged rendering on the invalidation refetch, never an error.
 */
export async function acknowledgeAlert(
  alertId: string,
  signal?: AbortSignal,
): Promise<{ alertId: string }> {
  try {
    if (env.useMocks) return await acknowledgeAlertMock(alertId, signal);

    const result = await opsAcknowledgeAlert({
      path: { id: alertId },
      headers: { "Idempotency-Key": mintIdempotencyKey() },
      signal,
    });
    if (result.data === undefined) throw result.response;
    return { alertId };
  } catch (thrown) {
    throw normalizeError(thrown, "The alert could not be acknowledged.");
  }
}
