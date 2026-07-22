import { MoreVertical, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Gutter, SectionGap } from "../../layouts/Layout";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
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

      {/* At 26 characters "Completed (admin verified)" does not fit beside a mono booking number
          and an overflow button, and truncating a legal-record label is not an option — so the
          pill sits on its own row beneath the app bar (design M10). */}
      {detail.escalation ? null : (
        <Gutter className="pt-s3">
          <BookingStatePill state={detail.state} isAdminVerified={detail.isAdminVerified} />
        </Gutter>
      )}

      <BookingDetailBannerStack controller={controller} detail={detail} isOffline={isOffline} />

      <MobileScroll padFor="action">
        <Gutter className="py-s4">
          <ServiceSummaryBlock detail={detail} />
        </Gutter>
        <SectionGap />

        <Gutter className="py-s4">
          <CustomerBlock customer={detail.customer} isDisabled={isLocked} />
        </Gutter>
        <SectionGap />

        <Gutter className="py-s4">
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
        </Gutter>
        <SectionGap />

        <Gutter className="py-s4">
          <TimelineBlock detail={detail} />
        </Gutter>
        <SectionGap />

        <Gutter className="py-s4">
          <PaymentBlock payment={detail.payment} />
        </Gutter>
        <div className="h-s4" />
      </MobileScroll>

      {/* The sticky action bar. `.actionbar` has no layout primitive yet — flagged for one. */}
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
