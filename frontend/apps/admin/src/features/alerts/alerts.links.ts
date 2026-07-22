import { ROUTES } from "../../routes/routes.constants";
import { ALERT_SUBJECT_KINDS, type AlertSubject, type AlertSubjectKind } from "./alerts.types";

/**
 * Where an alert points. Alert Detail implements no action flow of its own — it hands off to the
 * feature that owns the record, so "assign a provider" is the same screen whichever door you came
 * through (spec §6.21).
 */
export function recordRouteFor(subject: AlertSubject | null): string | null {
  if (!subject) return null;
  return subject.kind === ALERT_SUBJECT_KINDS.booking
    ? ROUTES.bookingDetail(subject.id)
    : ROUTES.providerDetail(subject.id);
}

/** The contextual fix for an unplaced booking: the rescue-only assign screen. */
export function assignRouteFor(subject: AlertSubject | null): string | null {
  if (!subject || subject.kind !== ALERT_SUBJECT_KINDS.booking) return null;
  return ROUTES.bookingAssign(subject.id);
}

export function isBooking(kind: AlertSubjectKind): boolean {
  return kind === ALERT_SUBJECT_KINDS.booking;
}
