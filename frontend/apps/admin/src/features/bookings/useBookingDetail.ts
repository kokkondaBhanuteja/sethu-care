import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { API_ERROR_CODES, normalizeError } from "../../lib/http/apiError";
import { fetchBookingDetail } from "./bookings.api";
import { BOOKING_INTENT_PARAM, BOOKING_QUERY_KEYS } from "./bookings.constants";
import {
  BOOKING_ACTION_IDS,
  useBookingActions,
  type BookingActionId,
  type BookingActionSet,
} from "./useBookingActions";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailController {
  readonly query: UseQueryResult<BookingDetail>;
  readonly detail: BookingDetail | undefined;
  readonly isNotFound: boolean;
  /**
   * The record on screen is behind the server. Every write path goes inert together — half-disabling
   * is worse than not disabling at all, because the one live button becomes the one that is trusted.
   */
  readonly isSuperseded: boolean;
  readonly acceptChange: () => void;
  /** Spec §3.4 rule 4: a deep link to an action whose situation is already resolved lands here. */
  readonly hasResolvedIntent: boolean;
  readonly actions: BookingActionSet;
}

/**
 * One record's state for both shells. The concurrency rule lives here rather than in a component
 * because the desktop three-column view and the mobile stack must go inert on exactly the same
 * condition (spec §6.9 edge cases, and the design's BOX 9 / M11).
 */
export function useBookingDetail(bookingId: string): BookingDetailController {
  const [searchParams] = useSearchParams();
  const [hasAcceptedChange, setHasAcceptedChange] = useState(false);

  const query = useQuery({
    queryKey: BOOKING_QUERY_KEYS.detail(bookingId),
    queryFn: ({ signal }) => fetchBookingDetail(bookingId, signal),
    retry: false,
  });

  const detail = query.data;
  const actions = useBookingActions(bookingId, detail?.state ?? null);

  const isNotFound =
    query.isError && normalizeError(query.error, "").code === API_ERROR_CODES.notFound;

  // Reload re-reads the record and drops the notice. Against the mock the record is static, so the
  // flag is what clears the banner; against the real endpoint the refetch returns a record whose
  // `version` has moved on and `concurrentChange` is gone.
  const { refetch } = query;
  const acceptChange = useCallback(() => {
    setHasAcceptedChange(true);
    void refetch();
  }, [refetch]);

  const intent = searchParams.get(BOOKING_INTENT_PARAM);
  const hasResolvedIntent =
    intent !== null &&
    detail !== undefined &&
    isBookingActionId(intent) &&
    !actions.all.some((action) => action.id === intent);

  return {
    query,
    detail,
    isNotFound,
    isSuperseded: detail?.concurrentChange != null && !hasAcceptedChange,
    acceptChange,
    hasResolvedIntent,
    actions,
  };
}

function isBookingActionId(value: string): value is BookingActionId {
  const known: readonly string[] = Object.values(BOOKING_ACTION_IDS);
  return known.includes(value);
}
