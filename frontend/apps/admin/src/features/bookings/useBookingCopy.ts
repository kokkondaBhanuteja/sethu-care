import { useCallback, useMemo } from "react";
import { useTranslation } from "@sethu/i18n";

import { formatDuration, formatTime } from "../../lib/format";
import type { TimelineEntry } from "../../components/ui/Timeline";
import type { BookingEvent, BookingListItem, ProviderNote } from "./bookings.types";

/**
 * Turns the record's structured fragments into sentences. The API returns data plus a discriminant
 * — never a pre-built English string — so the provider line and every timeline event are composed
 * here, once, inside `t()`. That is what keeps hi/te translatable rather than half-hardcoded.
 */
export function useBookingCopy() {
  const { t } = useTranslation("adminBookings");

  /** "Suresh Mehta" reads as "Suresh M." in a dense row — the design's own abbreviation. */
  const shortName = useCallback((name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? name;
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
    return last ? `${first} ${last.charAt(0)}.` : first;
  }, []);

  const providerNoteText = useCallback(
    (note: ProviderNote, providerName: string | null): string => {
      const name = providerName ? shortName(providerName) : t("provider.unassigned");
      switch (note.kind) {
        case "unassignedFor":
          return t("provider.unassignedFor", { minutes: note.minutes });
        case "eta":
          return t("provider.eta", { name, minutes: note.minutes });
        case "startedAt":
          return t("provider.startedAt", { name, time: formatTime(note.at) });
        case "arrivedAgo":
          return t("provider.arrivedAgo", { name, minutes: note.minutes });
        case "rating":
          return t("provider.rating", { name, rating: note.rating.toFixed(1) });
        case "none":
          return name;
      }
    },
    [shortName, t],
  );

  const providerLine = useCallback(
    (item: BookingListItem): string =>
      t("provider.line", { value: providerNoteText(item.providerNote, item.providerName) }),
    [providerNoteText, t],
  );

  const escalationTitle = useCallback(
    (minutesUnresolved: number): string =>
      t("banner.escalatedTitle", { age: formatDuration(minutesUnresolved * 60_000) }),
    [t],
  );

  const escalationWide = useCallback(
    (minutesUnresolved: number, rounds: number): string =>
      t("banner.escalatedWide", {
        age: formatDuration(minutesUnresolved * 60_000),
        rounds,
      }),
    [t],
  );

  const timelineEntries = useCallback(
    (events: readonly BookingEvent[]): readonly TimelineEntry[] => {
      function bodyFor(event: BookingEvent): string {
        switch (event.kind) {
          case "dispatchRound":
            return event.round
              ? t("timeline.dispatchRound", {
                  number: event.round.number,
                  radius: event.round.radiusKm,
                  contacted: event.round.contacted,
                  declined: event.round.declined,
                })
              : t("timeline.searching");
          case "autoAssigned":
            return t("timeline.autoAssigned", {
              name: event.providerName ?? "",
              number: event.round?.number ?? 1,
              radius: event.round?.radiusKm ?? 0,
            });
          case "completedByAdmin":
            return t("timeline.completedByAdmin", { name: event.actorName ?? "" });
          default:
            return t(`timeline.${event.kind}`);
        }
      }

      return events.map((event) => ({
        id: event.id,
        time: formatTime(event.at),
        tone: TIMELINE_TONE_BY_KIND[event.kind],
        emphasis: TIMELINE_EMPHASIS_BY_KIND[event.kind],
        body: bodyFor(event),
      }));
    },
    [t],
  );

  /** Only the rounds, for the desktop preview panel's "Dispatch rounds" rail (BOX 15). */
  const dispatchRoundEntries = useCallback(
    (events: readonly BookingEvent[]): readonly TimelineEntry[] =>
      timelineEntries(
        events.filter(
          (event) =>
            event.kind === "dispatchRound" ||
            event.kind === "autoAssigned" ||
            event.kind === "escalated",
        ),
      ),
    [timelineEntries],
  );

  return useMemo(
    () => ({
      shortName,
      providerNoteText,
      providerLine,
      escalationTitle,
      escalationWide,
      timelineEntries,
      dispatchRoundEntries,
    }),
    [
      shortName,
      providerNoteText,
      providerLine,
      escalationTitle,
      escalationWide,
      timelineEntries,
      dispatchRoundEntries,
    ],
  );
}

const TIMELINE_TONE_BY_KIND: Readonly<Record<BookingEvent["kind"], TimelineEntry["tone"]>> = {
  created: "neutral",
  searching: "info",
  dispatchRound: "info",
  autoAssigned: "info",
  enRoute: "info",
  arrived: "info",
  started: "success",
  completionOtpFailed: "warning",
  completed: "success",
  completedByAdmin: "success",
  assignmentFailed: "danger",
  escalated: "danger",
  cancelled: "danger",
};

/** The dispatch rounds carry extra weight: they are the failure diagnostic, not ordinary events. */
const TIMELINE_EMPHASIS_BY_KIND: Readonly<Record<BookingEvent["kind"], TimelineEntry["emphasis"]>> =
  {
    created: "muted",
    searching: "muted",
    dispatchRound: "strong",
    autoAssigned: "strong",
    enRoute: "default",
    arrived: "default",
    started: "default",
    completionOtpFailed: "strong",
    completed: "default",
    completedByAdmin: "strong",
    assignmentFailed: "danger",
    escalated: "danger",
    cancelled: "danger",
  };
