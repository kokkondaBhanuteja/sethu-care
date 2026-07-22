import { normalizeError } from "../../lib/http/apiError";
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
// None of these endpoints exists on the backend yet — see docs/admin-api-contract.md
// (`GET /ops/dashboard/summary`, `/ops/dashboard/attention`, `/ops/dashboard/band`,
// `/ops/activity`, `POST /ops/alerts/{id}/acknowledge`). When they land, the generated client's
// call replaces the mock call below and nothing above this file changes.

export async function fetchDashboardSummary(
  period: DashboardPeriod,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  try {
    return await fetchDashboardSummaryMock(period, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Today's figures could not be loaded.");
  }
}

export async function fetchAlertBand(signal?: AbortSignal): Promise<AlertBandState> {
  try {
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
    return await fetchAttentionQueueMock(filter, limit, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The attention queue could not be loaded.");
  }
}

export async function fetchActivity(
  limit: number,
  signal?: AbortSignal,
): Promise<readonly ActivityEntry[]> {
  try {
    return await fetchActivityMock(limit, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Recent activity could not be loaded.");
  }
}

export async function acknowledgeAlert(
  alertId: string,
  signal?: AbortSignal,
): Promise<{ alertId: string }> {
  try {
    return await acknowledgeAlertMock(alertId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The alert could not be acknowledged.");
  }
}
