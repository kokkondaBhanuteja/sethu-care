// Pure shaping of one flat alert list into the two tiers the design draws.
//
// The split is NOT by severity, it is by whether a human has to claim the alert: `needs action`
// holds everything requiring acknowledgement (including one already acknowledged, which stays put
// so it can be seen leaving), and `notices` holds everything else. That is what lets five harmless
// alerts stop diluting two urgent ones (spec §6.20).

import { formatDate } from "../../lib/format";
import { SEVERITY_FILTER_ALL, type SeverityFilter } from "./alerts.constants";
import { ALERT_SEVERITIES, type Alert, type AlertSeverity } from "./alerts.types";

export interface AlertTiers {
  readonly needsAction: readonly Alert[];
  readonly noticesToday: readonly Alert[];
  readonly noticesEarlier: readonly Alert[];
  readonly noticeCount: number;
}

export type SeverityCounts = Readonly<Record<AlertSeverity, number>>;

function newestFirst(left: Alert, right: Alert): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

export function matchesFilter(alert: Alert, filter: SeverityFilter): boolean {
  return filter === SEVERITY_FILTER_ALL || alert.severity === filter;
}

export function splitTiers(alerts: readonly Alert[], filter: SeverityFilter): AlertTiers {
  const visible = alerts.filter((alert) => matchesFilter(alert, filter));
  const today = formatDate(new Date());

  const needsAction = visible.filter((alert) => alert.requiresAcknowledgement).sort(newestFirst);
  const notices = visible.filter((alert) => !alert.requiresAcknowledgement).sort(newestFirst);

  return {
    needsAction,
    noticesToday: notices.filter((alert) => formatDate(alert.createdAt) === today),
    noticesEarlier: notices.filter((alert) => formatDate(alert.createdAt) !== today),
    noticeCount: notices.length,
  };
}

/** Chip counts are always of the whole feed — a filtered chip row that renumbers itself is a trap. */
export function countBySeverity(alerts: readonly Alert[]): SeverityCounts {
  return {
    [ALERT_SEVERITIES.critical]: countOf(alerts, ALERT_SEVERITIES.critical),
    [ALERT_SEVERITIES.warning]: countOf(alerts, ALERT_SEVERITIES.warning),
    [ALERT_SEVERITIES.informational]: countOf(alerts, ALERT_SEVERITIES.informational),
  };
}

function countOf(alerts: readonly Alert[], severity: AlertSeverity): number {
  return alerts.filter((alert) => alert.severity === severity).length;
}

/**
 * The number behind the Alerts badge and the "Needs action" count: unacknowledged criticals only.
 * Anything wider makes the badge permanently non-zero, and a permanently non-zero badge is
 * invisible (spec §3.1).
 */
export function countUnacknowledgedCritical(alerts: readonly Alert[]): number {
  return alerts.filter(
    (alert) =>
      alert.severity === ALERT_SEVERITIES.critical &&
      alert.requiresAcknowledgement &&
      alert.acknowledgement === null,
  ).length;
}
