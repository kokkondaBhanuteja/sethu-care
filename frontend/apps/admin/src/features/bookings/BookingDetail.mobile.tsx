import { MoreVertical, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { BookingActionButtons } from "./BookingActionButtons";
import { BookingDetailBannerStack } from "./BookingDetailBannerStack";
import { BookingStatePill } from "./BookingStatePill";
import { CustomerBlock, PaymentBlock, ProviderBlock } from "./BookingRecordBlocks";
import { ServiceSummaryBlock, TimelineBlock } from "./BookingSummaryBlocks";
import type { BookingDetailController } from "./useBookingDetail";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailMobileProps {
  controller: BookingDetailController;
  detail: BookingDetail;
  isOffline: boolean;
}

/** An 8px recessed band between sections — what gives the detail screens their document rhythm. */
function SectionGap() {
  return <div className="h-s2 bg-surface border-y border-border-subtle" aria-hidden />;
}

/**
 * The stacked phone record. The timeline is the most important thing on it, and the sticky action
 * bar carries exactly one decision: filled and primary when something is wrong, outlined and
 * low-stakes when nothing is. Nothing is asking to be decided on a healthy job, so nothing shouts.
 */
export function BookingDetailMobile({ controller, detail, isOffline }: BookingDetailMobileProps) {
  const { t } = useTranslation("adminBookings");
  const isLocked = controller.isSuperseded || isOffline;
  const { primary } = controller.actions;

  return (
    <>
      <MobileAppBar
        title={detail.reference}
        showBack
        compact
        bordered
        actions={
          <Button
            variant="text"
            size="inline"
            iconStart={MoreVertical}
            aria-label={t("detail.moreActions")}
          />
        }
      />

      {detail.escalation ? null : (
        <div className="px-s4 pt-s3">
          <BookingStatePill state={detail.state} isAdminVerified={detail.isAdminVerified} />
        </div>
      )}

      <BookingDetailBannerStack controller={controller} detail={detail} isOffline={isOffline} />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-s4 py-s4">
          <ServiceSummaryBlock detail={detail} />
        </div>
        <SectionGap />

        <div className="px-s4 py-s4">
          <CustomerBlock customer={detail.customer} isDisabled={isLocked} />
        </div>
        <SectionGap />

        <div className="px-s4 py-s4">
          <ProviderBlock
            provider={detail.provider}
            roundCount={detail.dispatchRounds.length}
            declinedTotal={detail.declinedTotal}
            action={
              controller.actions.secondary.length > 0 ? (
                <div className="flex flex-col gap-s2">
                  <BookingActionButtons
                    actions={controller.actions.secondary}
                    size="section"
                    block
                    isDisabled={isLocked}
                  />
                </div>
              ) : undefined
            }
          />
        </div>
        <SectionGap />

        <div className="px-s4 py-s4">
          <TimelineBlock detail={detail} />
        </div>
        <SectionGap />

        <div className="px-s4 py-s4">
          <PaymentBlock payment={detail.payment} />
        </div>
        <div className="h-s4" />
      </div>

      <div className="flex-none bg-canvas border-t border-border-subtle px-s4 py-s3">
        {primary ? (
          <BookingActionButtons
            actions={[primary]}
            size="primary"
            block
            isDisabled={isLocked}
            primaryActionId={primary.id}
          />
        ) : (
          <Button
            variant="outline"
            size="primary"
            block
            iconStart={Phone}
            disabled={isLocked || detail.provider === null}
          >
            {t("actions.callProvider")}
          </Button>
        )}
        {isOffline ? (
          <p className="text-caption text-text-3 text-center mt-s2">
            {t("banner.offlineActionNote")}
          </p>
        ) : null}
      </div>
    </>
  );
}
