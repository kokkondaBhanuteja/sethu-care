import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Panel } from "../../components/ui/Panel";
import { ROUTES } from "../../routes/routes.constants";
import { BookingPreviewContent, BookingPreviewSkeleton } from "./BookingPreviewContent";
import { MonoText } from "./RecordText";
import type { BookingDetail } from "./bookings.types";

export interface BookingPreviewPanelProps {
  detail: BookingDetail | undefined;
  isLoading: boolean;
  footer?: React.ReactNode;
}

/**
 * The right-hand preview of the selected row, shown only where a real second column exists
 * (≥1280px — below that BookingPreviewDrawer serves the same content on demand). Selecting a row
 * never leaves the list, so the ops manager can walk the queue top-to-bottom without losing scroll
 * position — the same question cost a push and a back on mobile.
 *
 * It skeletons while the list reloads rather than keeping the previous booking rendered: a record
 * that may no longer be in the result set is worse than a placeholder.
 */
export function BookingPreviewPanel({ detail, isLoading, footer }: BookingPreviewPanelProps) {
  const { t } = useTranslation("adminBookings");

  if (isLoading || !detail) {
    return (
      <Panel title={t("section.preview")} flush={false}>
        <BookingPreviewSkeleton />
      </Panel>
    );
  }

  return (
    <Panel
      title={t("section.preview")}
      headerActions={
        <>
          <MonoText className="text-text-2">{detail.reference}</MonoText>
          <Link className="text-label text-brand" to={ROUTES.bookingDetail(detail.id)}>
            {t("detail.openFull")}
          </Link>
        </>
      }
      flush={false}
      footer={footer}
    >
      <BookingPreviewContent detail={detail} />
    </Panel>
  );
}
