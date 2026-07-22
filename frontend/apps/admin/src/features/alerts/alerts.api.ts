// The only boundary between the alerts feature and its data.
//
// None of these endpoints exists on the backend yet — docs/admin-api-contract.md lists them under
// MISSING. When they land, each mock call below is replaced by the generated client's call and
// nothing above this file changes.

import { normalizeError } from "../../lib/http/apiError";
import { addAlertNoteMock, fetchAlertDetailMock } from "./alertDetail.mock";
import { acknowledgeAlertMock, fetchAlertsMock, markInformationalReadMock } from "./alerts.mock";
import type { AcknowledgeResult, Alert, AlertDetail, AlertNote } from "./alerts.types";

/** `GET /ops/alerts` */
export async function fetchAlerts(signal?: AbortSignal): Promise<readonly Alert[]> {
  try {
    return await fetchAlertsMock(signal);
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
    return await fetchAlertDetailMock(alertId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This alert could not be loaded.");
  }
}

/**
 * `POST /ops/alerts/{id}/acknowledge` — idempotent and concurrency-safe by contract. Two operators
 * acknowledging at once is a normal outcome, not an error: the loser gets `wonRace: false` and the
 * winner's name, which the UI renders as information rather than failure (spec §6.20 edge cases).
 */
export async function acknowledgeAlert(
  alertId: string,
  signal?: AbortSignal,
): Promise<AcknowledgeResult> {
  try {
    return await acknowledgeAlertMock(alertId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This alert could not be acknowledged.");
  }
}

/** `POST /ops/alerts/read-all` — informational tier only; it never bulk-acknowledges a critical. */
export async function markInformationalRead(signal?: AbortSignal): Promise<number> {
  try {
    return await markInformationalReadMock(signal);
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
    return await addAlertNoteMock(alertId, body, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The note could not be added.");
  }
}
