import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { BookingActionButtons } from "./BookingActionButtons";
import { BookingStatePill } from "./BookingStatePill";
import { CustomerBlock, PaymentBlock, ProviderBlock } from "./BookingRecordBlocks";
import {
  AdminActivityBlock,
  NotesBlock,
  ServiceSummaryBlock,
  TimelineBlock,
} from "./BookingSummaryBlocks";
import { BookingDetailBannerStack } from "./BookingDetailBannerStack";
import type { BookingDetailController } from "./useBookingDetail";
import type { BookingDetail } from "./bookings.types";

export interface BookingDetailDesktopProps {
  controller: BookingDetailController;
  detail: BookingDetail;
  isOffline: boolean;
}

/**
 * The three-column record view. Mobile stacks these sections and makes the ops manager scroll past
 * the customer to reach the timeline; desktop puts identity on the left, the diagnostic in the
 * middle at full height, and the actions on the right — so "why is this stuck?" and the control
 * that answers it are visible at the same moment (design BOX 6).
 *
 * A healthy booking shows its state as a pill beside the breadcrumb rather than a full-bleed strip:
 * the strip is reserved for the exception, and spending it here would devalue it on the escalation.
 */
export function BookingDetailDesktop({ controller, detail, isOffline }: BookingDetailDesktopProps) {
  const { t } = useTranslation("adminBookings");
  const isLocked = controller.isSuperseded || isOffline;

  return (
    <>
      <Topbar
        crumbs={[{ label: t("title"), to: ROUTES.bookings }, { label: detail.reference }]}
        actions={
          detail.escalation ? null : (
            <BookingStatePill state={detail.state} isAdminVerified={detail.isAdminVerified} />
          )
        }
      />

      <BookingDetailBannerStack
        controller={controller}
        detail={detail}
        isOffline={isOffline}
        isWide
      />

      <main className="flex-1 overflow-y-auto bg-canvas p-s6">
        <div className="grid grid-cols-1 gap-s5 lg:grid-cols-3">
          <div className="flex flex-col gap-s5 min-w-0">
            <Card>
              <ServiceSummaryBlock detail={detail} />
            </Card>
            <Card>
              <CustomerBlock customer={detail.customer} isDisabled={isLocked} />
            </Card>
            <Card>
              <PaymentBlock payment={detail.payment} />
            </Card>
          </div>

          <div className="flex flex-col gap-s5 min-w-0">
            <Card>
              <TimelineBlock detail={detail} />
            </Card>
          </div>

          <div className="flex flex-col gap-s5 min-w-0">
            <Card>
              <ProviderBlock
                provider={detail.provider}
                roundCount={detail.dispatchRounds.length}
                declinedTotal={detail.declinedTotal}
                action={
                  controller.actions.all.length > 0 ? (
                    <div className="flex flex-col gap-s2">
                      <BookingActionButtons
                        actions={controller.actions.all}
                        size="section"
                        block
                        isDisabled={isLocked}
                        primaryActionId={controller.actions.primary?.id}
                      />
                    </div>
                  ) : undefined
                }
              />
            </Card>
            <Card>
              <AdminActivityBlock activity={detail.adminActivity} />
            </Card>
            <Card>
              <NotesBlock notes={detail.notes} isDisabled={isLocked} />
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
