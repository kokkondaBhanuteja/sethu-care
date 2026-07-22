import { normalizeError } from "../../lib/http/apiError";
import { ErrorState } from "../../components/ui/ErrorState";
import { BookingDetailDesktop } from "./BookingDetail.desktop";
import { BookingDetailMobile } from "./BookingDetail.mobile";
import { BookingDetailSkeleton } from "./BookingDetailSkeleton";
import { BookingNotFound } from "./BookingNotFound";
import { useBookingDetail } from "./useBookingDetail";
import { useIsOffline } from "./useIsOffline";

export interface BookingDetailScreenProps {
  bookingId: string;
  isDesktop: boolean;
}

/**
 * The record's state switch, shared by both shells so "not found", "failed to load" and "loading"
 * can never diverge between them. QueryBoundary is not used here: not-found is a condition of the
 * record rather than of the query, and it must swallow the whole screen including its chrome.
 */
export function BookingDetailScreen({ bookingId, isDesktop }: BookingDetailScreenProps) {
  const controller = useBookingDetail(bookingId);
  const isOffline = useIsOffline();
  const { query, detail } = controller;

  if (controller.isNotFound) return <BookingNotFound />;

  if (query.isError) {
    return (
      <ErrorState
        error={normalizeError(query.error, "This booking could not be loaded.")}
        onRetry={() => void query.refetch()}
        grow
      />
    );
  }

  if (query.isPending || !detail) return <BookingDetailSkeleton isDesktop={isDesktop} />;

  return isDesktop ? (
    <BookingDetailDesktop controller={controller} detail={detail} isOffline={isOffline} />
  ) : (
    <BookingDetailMobile controller={controller} detail={detail} isOffline={isOffline} />
  );
}
