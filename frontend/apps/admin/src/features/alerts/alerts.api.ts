// The only boundary between the alerts feature and its data.
//
// All five endpoints are real and served through the generated client when mocks are off; the mock
// branch is untouched, so unit tests and e2e runs behave exactly as before. No component, hook or
// type above this file changed in the flip — which is the whole point of this boundary.
//
// The id convention on `{id}` routes: an alert's own uuid works, AND a booking uuid resolves to
// that subject's newest alert — the dashboard's attention queue hands out booking-scoped ids and
// both land here.

import {
  opsAcknowledgeAlert,
  opsCreateAlertNote,
  opsGetAlert,
  opsListAlerts,
  opsReadAllAlerts,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import { addAlertNoteMock, fetchAlertDetailMock } from "./alertDetail.mock";
import {
  ALERTS_FETCH_CAP,
  mapAcknowledgeResult,
  mapAlert,
  mapAlertDetail,
  mapAlertNote,
} from "./alerts.api.map";
import { acknowledgeAlertMock, fetchAlertsMock, markInformationalReadMock } from "./alerts.mock";
import type { AcknowledgeResult, Alert, AlertDetail, AlertNote } from "./alerts.types";

/**
 * One key per operator intent — and every call below IS one intent: mutations never auto-retry,
 * and the offline queue replays each queued acknowledgement once. (booking-actions mints per flow
 * through useIdempotencyKey because a form retried after a timeout must reuse its key; an
 * acknowledgement is additionally idempotent per ALERT — first-writer-wins — so a fresh key per
 * call cannot double-acknowledge.)
 */
function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews without randomUUID still need a key; the backend scopes it per admin + endpoint.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * `GET /ops/alerts` — always the WHOLE feed. Omitting `acknowledged` returns every tier and every
 * acknowledgement state (only `acknowledged=true` narrows), and the two-tier split, the severity
 * chips and the badge arithmetic are all client-side in alerts.selectors/.filters.
 */
export async function fetchAlerts(signal?: AbortSignal): Promise<readonly Alert[]> {
  try {
    if (env.useMocks) return await fetchAlertsMock(signal);

    const result = await opsListAlerts({ query: { limit: ALERTS_FETCH_CAP }, signal });
    if (result.data === undefined) throw result.response;
    return result.data.items.map(mapAlert);
  } catch (thrown) {
    throw normalizeError(thrown, "Alerts could not be loaded.");
  }
}

/** `GET /ops/alerts/{id}` — a deleted or unknown id must arrive here as a not_found ApiError. */
export async function fetchAlertDetail(
  alertId: string,
  signal?: AbortSignal,
): Promise<AlertDetail> {
  try {
    if (env.useMocks) return await fetchAlertDetailMock(alertId, signal);

    const result = await opsGetAlert({ path: { id: alertId }, signal });
    if (result.data === undefined) throw result.response;
    return mapAlertDetail(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "This alert could not be loaded.");
  }
}

/**
 * `POST /ops/alerts/{id}/acknowledge` — idempotent and concurrency-safe by contract. Two operators
 * acknowledging at once is a normal outcome, not an error: the loser gets HTTP 200, `wonRace:
 * false` and the winner's acknowledgement, which the UI renders as information rather than failure
 * (spec §6.20 edge cases).
 */
export async function acknowledgeAlert(
  alertId: string,
  signal?: AbortSignal,
): Promise<AcknowledgeResult> {
  try {
    if (env.useMocks) return await acknowledgeAlertMock(alertId, signal);

    const result = await opsAcknowledgeAlert({
      path: { id: alertId },
      headers: { "Idempotency-Key": mintIdempotencyKey() },
      signal,
    });
    if (result.data === undefined) throw result.response;
    return mapAcknowledgeResult(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "This alert could not be acknowledged.");
  }
}

/** `POST /ops/alerts/read-all` — informational tier only; it never bulk-acknowledges a critical. */
export async function markInformationalRead(signal?: AbortSignal): Promise<number> {
  try {
    if (env.useMocks) return await markInformationalReadMock(signal);

    const result = await opsReadAllAlerts({
      headers: { "Idempotency-Key": mintIdempotencyKey() },
      signal,
    });
    if (result.data === undefined) throw result.response;
    return result.data.markedRead;
  } catch (thrown) {
    throw normalizeError(thrown, "Alerts could not be marked read.");
  }
}

/** `POST /ops/alerts/{id}/notes` — the handover record between admins on the same alert. */
export async function addAlertNote(
  alertId: string,
  body: string,
  signal?: AbortSignal,
): Promise<AlertNote> {
  try {
    if (env.useMocks) return await addAlertNoteMock(alertId, body, signal);

    const result = await opsCreateAlertNote({
      path: { id: alertId },
      body: { body },
      headers: { "Idempotency-Key": mintIdempotencyKey() },
      signal,
    });
    if (result.data === undefined) throw result.response;
    return mapAlertNote(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "The note could not be added.");
  }
}
