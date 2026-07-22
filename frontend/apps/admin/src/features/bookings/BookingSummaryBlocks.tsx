import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Timeline } from "../../components/ui/Timeline";
import { formatDateTime, formatMoney, formatTime } from "../../lib/format";
import { RecordSection } from "./RecordText";
import { useBookingCopy } from "./useBookingCopy";
import type { BookingAdminActivity, BookingDetail } from "./bookings.types";

export interface ServiceSummaryBlockProps {
  detail: BookingDetail;
}

/**
 * Service, price and creation time. There is deliberately no scheduled slot: this is an on-demand
 * product, a booking dispatches the moment it is created, so there is nothing to schedule and no
 * future-dated state to show (docs/Booking-Workflow-Decisions.md D1).
 */
export function ServiceSummaryBlock({ detail }: ServiceSummaryBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div>
      <h2 className="text-section text-text-1 break-words">{detail.serviceTitle}</h2>
      <p className="text-body text-text-2 mt-s1">
        {t("detail.priceLine", {
          amount: formatMoney(detail.amountPaise),
          method: detail.payment.methodLabel,
        })}
      </p>
      <p className="text-label text-text-3 mt-s1">
        {t("detail.created", { value: formatDateTime(detail.createdAt) })}
      </p>
    </div>
  );
}

export interface TimelineBlockProps {
  detail: BookingDetail;
}

/**
 * The most important thing on this screen now that dispatch is automated. The round lines carry
 * semibold weight because the widening radius and the climbing decline count are the "why did this
 * fail" diagnostic — the reason an ops manager opened the record at all (Booking-Workflow §7).
 */
export function TimelineBlock({ detail }: TimelineBlockProps) {
  const { t } = useTranslation("adminBookings");
  const { timelineEntries } = useBookingCopy();

  return (
    <RecordSection label={t("section.timeline")}>
      <Timeline label={t("timeline.label")} entries={timelineEntries(detail.timeline)} />
    </RecordSection>
  );
}

export interface AdminActivityBlockProps {
  activity: readonly BookingAdminActivity[];
}

/** Who touched this booking, and whether anyone did. Provenance, not a second timeline. */
export function AdminActivityBlock({ activity }: AdminActivityBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <RecordSection label={t("section.adminActions")}>
      {activity.length === 0 ? (
        <p className="text-label text-text-3">{t("detail.noAdminIntervention")}</p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {activity.map((entry) => (
            <li key={entry.id} className="text-label text-text-2">
              {t(`activity.${entry.kind}`, {
                name: entry.actorName ?? "",
                time: formatTime(entry.at),
              })}
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
}

export interface NotesBlockProps {
  notes: readonly string[];
  isDisabled?: boolean;
}

export function NotesBlock({ notes, isDisabled = false }: NotesBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <RecordSection label={t("section.notes")}>
      {notes.length === 0 ? (
        <p className="text-label text-text-3">{t("detail.noNotes")}</p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {notes.map((note) => (
            <li key={note} className="text-label text-text-2 break-words">
              {note}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-s3">
        <Button variant="outline" size="inline" block disabled={isDisabled}>
          {t("detail.addNote")}
        </Button>
      </div>
    </RecordSection>
  );
}
