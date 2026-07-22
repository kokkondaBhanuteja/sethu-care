import { useTranslation } from "@sethu/i18n";
import { Card, CardContent, PageHeader } from "@sethu/ui-web";

import { Stack } from "../../layouts/Layout";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { DETAIL_SECTION_CHIPS } from "./bookings.constants";
import { BookingActionBar } from "./BookingActionBar";
import { BookingDetailBannerStack } from "./BookingDetailBannerStack";
import { BookingSectionCard } from "./BookingSectionCard";
import { BookingStatePill } from "./BookingStatePill";
import { CustomerBlock, PaymentBlock, ProviderBlock } from "./BookingRecordBlocks";
import {
  AdminActivityBlock,
  NotesBlock,
  ServiceSummaryBlock,
  TimelineBlock,
} from "./BookingSummaryBlocks";
import { MonoText } from "./RecordText";
import type { BookingDetailController } from "./useBookingDetail";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailDesktopProps {
  controller: BookingDetailController;
  detail: BookingDetail;
  isOffline: boolean;
}

/**
 * The record view on the approved header-and-cards anatomy: the page header carries the booking id,
 * its state pill and the action bar (outline secondaries + one filled primary + overflow), and each
 * section is an icon-headed card. Identity sits left, the timeline diagnostic centre at full
 * height, provider and provenance right — "why is this stuck?" and the control that answers it are
 * visible in the same glance (design BOX 6, Figma #7).
 */
export function BookingDetailDesktop({ controller, detail, isOffline }: BookingDetailDesktopProps) {
  const { t } = useTranslation("adminBookings");
  const isLocked = controller.isSuperseded || isOffline;

  return (
    <>
      <Topbar
        crumbs={[{ label: t("title"), to: ROUTES.bookings }, { label: detail.reference }]}
        pageRendersHeading
      />

      <PageMain>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              <MonoText>{detail.reference}</MonoText>
              <BookingStatePill state={detail.state} isAdminVerified={detail.isAdminVerified} />
            </span>
          }
          actions={<BookingActionBar actions={controller.actions} isDisabled={isLocked} />}
        />

        <BookingDetailBannerStack
          controller={controller}
          detail={detail}
          isOffline={isOffline}
          isWide
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Stack className="min-w-0">
            <Card>
              <CardContent className="pt-4 sm:pt-5">
                <ServiceSummaryBlock detail={detail} />
              </CardContent>
            </Card>
            <BookingSectionCard title={t("section.customer")} chip={DETAIL_SECTION_CHIPS.customer}>
              <CustomerBlock customer={detail.customer} isDisabled={isLocked} />
            </BookingSectionCard>
            <BookingSectionCard title={t("section.payment")} chip={DETAIL_SECTION_CHIPS.payment}>
              <PaymentBlock payment={detail.payment} />
            </BookingSectionCard>
          </Stack>

          <Stack className="min-w-0">
            <BookingSectionCard title={t("section.timeline")} chip={DETAIL_SECTION_CHIPS.timeline}>
              <TimelineBlock detail={detail} />
            </BookingSectionCard>
          </Stack>

          <Stack className="min-w-0">
            <BookingSectionCard title={t("section.provider")} chip={DETAIL_SECTION_CHIPS.provider}>
              <ProviderBlock
                provider={detail.provider}
                roundCount={detail.dispatchRounds.length}
                declinedTotal={detail.declinedTotal}
              />
            </BookingSectionCard>
            <BookingSectionCard
              title={t("section.adminActions")}
              chip={DETAIL_SECTION_CHIPS.adminActions}
            >
              <AdminActivityBlock activity={detail.adminActivity} />
            </BookingSectionCard>
            <BookingSectionCard title={t("section.notes")} chip={DETAIL_SECTION_CHIPS.notes}>
              <NotesBlock notes={detail.notes} isDisabled={isLocked} />
            </BookingSectionCard>
          </Stack>
        </div>
      </PageMain>
    </>
  );
}
