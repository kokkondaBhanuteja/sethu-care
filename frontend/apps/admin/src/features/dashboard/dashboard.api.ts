import { opsActivityFeed, opsDashboardAttention, opsDashboardSummary } from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  ATTENTION_FETCH_CAP,
  mapActivityFeed,
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
// `GET /ops/dashboard/summary`, `/ops/dashboard/attention` and `/ops/activity` are real (backend
// commit 6543b30) and served through the generated client when mocks are off; the mock branch is
// untouched so unit tests and e2e runs behave exactly as before. The band and the acknowledge
// write are still mock-only — see the dated notes on each.

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
    // 2026-07-23: `GET /ops/dashboard/band` still answers 501 (it was not in backend commit
    // 6543b30's six endpoint groups), so the band stays on its mock in every mode. Flip it to
    // `opsDashboardBand` the moment the endpoint lands — nothing above this file changes.
    return await fetchAlertBandMock(signal);
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

export async function acknowledgeAlert(
  alertId: string,
  signal?: AbortSignal,
): Promise<{ alertId: string }> {
  try {
    // 2026-07-23: still mock in every mode — mutations belong to the booking-actions integration
    // wave (`POST /ops/alerts/{id}/acknowledge` flips here with the other writes).
    return await acknowledgeAlertMock(alertId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The alert could not be acknowledged.");
  }
}
