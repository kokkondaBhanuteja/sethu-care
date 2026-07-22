import { useNavigate } from "react-router";
import { MoreVertical, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import {
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import { Gutter } from "../../layouts/Layout";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { DETAIL_SECTION_CHIPS } from "./bookings.constants";
import { BookingActionButtons } from "./BookingActionButtons";
import { BookingDetailBannerStack } from "./BookingDetailBannerStack";
import { BookingSectionCard } from "./BookingSectionCard";
import { BookingStatePill } from "./BookingStatePill";
import { CustomerBlock, PaymentBlock, ProviderBlock } from "./BookingRecordBlocks";
import { ServiceSummaryBlock, TimelineBlock } from "./BookingSummaryBlocks";
import { BOOKING_ACTION_IDS } from "./useBookingActions";
import type { BookingDetailController } from "./useBookingDetail";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailMobileProps {
  controller: BookingDetailController;
  detail: BookingDetail;
  isOffline: boolean;
}

/**
 * The stacked phone record: the same icon-headed section cards as desktop, in one column. The
 * timeline is the most important thing on it, and the sticky action bar carries exactly one
 * decision; the app bar's overflow menu holds the secondary actions so nothing shouts.
 */
export function BookingDetailMobile({ controller, detail, isOffline }: BookingDetailMobileProps) {
  const { t } = useTranslation("adminBookings");
  const navigate = useNavigate();
  const isLocked = controller.isSuperseded || isOffline;
  const { primary, secondary } = controller.actions;

  return (
    <>
      <MobileAppBar
        title={detail.reference}
        showBack
        compact
        bordered
        actions={
          secondary.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="text"
                  size="inline"
                  iconStart={MoreVertical}
                  aria-label={t("detail.moreActions")}
                  disabled={isLocked}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondary.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    tone={action.id === BOOKING_ACTION_IDS.cancel ? "destructive" : "default"}
                    onSelect={() => void navigate(action.to)}
                  >
                    {t(`actions.${action.id}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {/* At 26 characters "Completed (admin verified)" does not fit beside a mono booking number
          and an overflow button, and truncating a legal-record label is not an option — so the
          pill sits on its own row beneath the app bar (design M10). */}
      <Gutter className="pt-s3">
        <BookingStatePill state={detail.state} isAdminVerified={detail.isAdminVerified} />
      </Gutter>

      <MobileScroll padFor="action" className="px-s4 py-s4">
        <div className="flex flex-col gap-s4">
          {/* Inside the scroll region on purpose: pinned above it, the escalation strip ate a
              quarter of a 390px viewport for as long as the record was open (screen audit). The
              condition still leads the record — it is simply allowed to scroll with it. */}
          <BookingDetailBannerStack controller={controller} detail={detail} isOffline={isOffline} />
          <Card>
            <CardContent className="pt-4">
              <ServiceSummaryBlock detail={detail} />
            </CardContent>
          </Card>
          <BookingSectionCard title={t("section.customer")} chip={DETAIL_SECTION_CHIPS.customer}>
            <CustomerBlock customer={detail.customer} isDisabled={isLocked} />
          </BookingSectionCard>
          <BookingSectionCard title={t("section.provider")} chip={DETAIL_SECTION_CHIPS.provider}>
            <ProviderBlock provider={detail.provider} />
          </BookingSectionCard>
          <BookingSectionCard title={t("section.timeline")} chip={DETAIL_SECTION_CHIPS.timeline}>
            <TimelineBlock detail={detail} />
          </BookingSectionCard>
          <BookingSectionCard title={t("section.payment")} chip={DETAIL_SECTION_CHIPS.payment}>
            <PaymentBlock payment={detail.payment} />
          </BookingSectionCard>
        </div>
      </MobileScroll>

      {/* The sticky action bar: one decision, ≥44px tall (size="primary" is the 48px commit). */}
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
