// Assembly for `GET /ops/alerts/{id}` and `POST /ops/alerts/{id}/notes`.
//
// A detail is its feed row plus context. Every row in the feed therefore opens rather than 404-ing,
// and an id that exists in neither the feed nor the archive throws a not_found ApiError — which is
// what the deep-link rule needs to render NotFoundState instead of crashing (spec §3.4 rule 3).

import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { mockRead, mockWrite } from "../../mocks/mockTransport";
import { ARCHIVED_ALERTS, DETAIL_EXTRAS, genericExtras, minutesAgo } from "./alertDetail.fixtures";
import { findAlertInStore } from "./alerts.mock";
import type { AlertDetail, AlertNote } from "./alerts.types";

const notesByAlert = new Map<string, AlertNote[]>([
  [
    "AL-8823",
    [
      {
        id: "note-1",
        body: "Called Ravi, he can wait until 5 PM.",
        authorName: "Priya Sharma",
        createdAt: minutesAgo(7),
      },
    ],
  ],
]);

export function fetchAlertDetailMock(alertId: string, signal?: AbortSignal): Promise<AlertDetail> {
  return mockRead(
    () => {
      const base =
        findAlertInStore(alertId) ?? ARCHIVED_ALERTS.find((alert) => alert.id === alertId);
      if (!base) {
        throw apiError(API_ERROR_CODES.notFound, `No alert ${alertId}.`, { status: 404 });
      }
      return {
        ...base,
        ...(DETAIL_EXTRAS[alertId] ?? genericExtras(base)),
        notes: notesByAlert.get(alertId) ?? [],
      };
    },
    signal ? { signal } : {},
  );
}

export function addAlertNoteMock(
  alertId: string,
  body: string,
  signal?: AbortSignal,
): Promise<AlertNote> {
  return mockWrite(
    () => {
      const note: AlertNote = {
        id: `note-${Date.now()}`,
        body,
        authorName: "Ravi Kumar",
        createdAt: new Date().toISOString(),
      };
      notesByAlert.set(alertId, [...(notesByAlert.get(alertId) ?? []), note]);
      return note;
    },
    signal ? { signal } : {},
  );
}
