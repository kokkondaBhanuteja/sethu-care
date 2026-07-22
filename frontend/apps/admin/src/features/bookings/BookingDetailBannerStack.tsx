import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { BookingActionButtons } from "./BookingActionButtons";
import {
  ConcurrentChangeBanner,
  EscalationBanner,
  OfflineDetailBanner,
  ResolvedIntentBanner,
  VerificationBanner,
} from "./BookingDetailBanners";
import { BOOKING_ACTION_IDS } from "./useBookingActions";
import type { BookingDetailController } from "./useBookingDetail";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailBannerStackProps {
  controller: BookingDetailController;
  detail: BookingDetail;
  isOffline: boolean;
  /** Desktop draws a full-bleed strip; mobile stacks the title over the detail. */
  isWide?: boolean;
}

/**
 * Every persistent condition on this record, in the order the design stacks them: the concurrency
 * notice sits ABOVE the escalation banner it invalidates, so the reader learns the strip below is
 * out of date before they read it.
 */
export function BookingDetailBannerStack({
  controller,
  detail,
  isOffline,
  isWide = false,
}: BookingDetailBannerStackProps) {
  const { t } = useTranslation("adminBookings");
  const isLocked = controller.isSuperseded || isOffline;

  const escalationActions =
    detail.escalation &&
    (controller.actions.canAcknowledge || controller.actions.all.length > 0) ? (
      <>
        {controller.actions.canAcknowledge ? (
          <Button variant="primary" size="inline" disabled={isLocked}>
            {t("actions.acknowledge")}
          </Button>
        ) : null}
        <BookingActionButtons
          actions={controller.actions.all.filter(
            (action) => action.id === BOOKING_ACTION_IDS.assign,
          )}
          size="inline"
          isDisabled={isLocked}
        />
      </>
    ) : undefined;

  return (
    <>
      {controller.isSuperseded && detail.concurrentChange ? (
        <ConcurrentChangeBanner
          change={detail.concurrentChange}
          onReload={controller.acceptChange}
        />
      ) : null}

      {controller.hasResolvedIntent && !controller.isSuperseded ? <ResolvedIntentBanner /> : null}

      {isOffline ? <OfflineDetailBanner cachedAt={detail.createdAt} /> : null}

      {detail.verification ? <VerificationBanner verification={detail.verification} /> : null}

      {detail.escalation ? (
        <EscalationBanner
          escalation={detail.escalation}
          actions={escalationActions}
          isWide={isWide}
        />
      ) : null}
    </>
  );
}
