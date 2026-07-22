import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Drawer } from "../../components/ui/Drawer";
import { ROUTES } from "../../routes/routes.constants";
import { BookingPreviewContent, BookingPreviewSkeleton } from "./BookingPreviewContent";
import { MonoText } from "./RecordText";
import type { BookingDetail } from "./bookings.types";

export interface BookingPreviewDrawerProps {
  isOpen: boolean;
  onDismiss: () => void;
  detail: BookingDetail | undefined;
  isLoading: boolean;
  footer?: React.ReactNode;
}

/**
 * The preview below 1280px: the side panel's exact content as an on-demand right drawer, so the
 * queue table keeps the full canvas width instead of being squeezed against a permanent column
 * that no longer fits. Row click opens it; the chevron still commits to the full record.
 */
export function BookingPreviewDrawer({
  isOpen,
  onDismiss,
  detail,
  isLoading,
  footer,
}: BookingPreviewDrawerProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <Drawer
      isOpen={isOpen}
      title={t("section.preview")}
      width="narrow"
      onDismiss={onDismiss}
      footer={footer}
    >
      {isLoading || !detail ? (
        <BookingPreviewSkeleton />
      ) : (
        <div className="flex flex-col gap-s4">
          <div className="flex items-center justify-between gap-s3">
            <MonoText className="text-text-2">{detail.reference}</MonoText>
            <Link className="text-label text-brand" to={ROUTES.bookingDetail(detail.id)}>
              {t("detail.openFull")}
            </Link>
          </div>
          <BookingPreviewContent detail={detail} />
        </div>
      )}
    </Drawer>
  );
}
