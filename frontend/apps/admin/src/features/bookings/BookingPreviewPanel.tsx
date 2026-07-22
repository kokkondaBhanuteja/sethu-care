import { Link } from "react-router";
import { Siren } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { Timeline } from "../../components/ui/Timeline";
import { formatDateTime, formatMoney, formatPhone } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { MonoText, RecordSection } from "./RecordText";
import { useBookingCopy } from "./useBookingCopy";
import type { BookingDetail } from "./bookings.types";

export interface BookingPreviewPanelProps {
  detail: BookingDetail | undefined;
  isLoading: boolean;
  footer?: React.ReactNode;
}

/**
 * The right-hand preview of the selected row. Selecting a row never leaves the list, so the ops
 * manager can walk the queue top-to-bottom without losing scroll position — the same question cost
 * a push and a back on mobile.
 *
 * It skeletons while the list reloads rather than keeping the previous booking rendered: a record
 * that may no longer be in the result set is worse than a placeholder.
 */
export function BookingPreviewPanel({ detail, isLoading, footer }: BookingPreviewPanelProps) {
  const { t } = useTranslation("adminBookings");
  const { escalationTitle, dispatchRoundEntries } = useBookingCopy();

  if (isLoading || !detail) {
    return (
      <Panel title={t("section.preview")} flush={false}>
        <div className="flex flex-col gap-s4">
          <Skeleton className="h-row-56 w-full" />
          <Skeleton shape="text" className="w-3/4" />
          <Skeleton shape="text" className="w-1/2" />
          <Skeleton className="h-row-56 w-full" />
          <Skeleton shape="text" className="w-5/6" />
          <Skeleton shape="text" className="w-2/3" />
        </div>
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
      <div className="flex flex-col gap-s4">
        {detail.escalation ? (
          <Card tone="danger" edge="danger" density="tight">
            <div className="flex items-start gap-s3">
              <Icon glyph={Siren} className="text-danger" />
              <div className="flex flex-col">
                <span className="text-emph text-danger">
                  {escalationTitle(detail.escalation.minutesUnresolved)}
                </span>
                <span className="text-label text-text-2">
                  {t("banner.escalatedDetail", { rounds: detail.escalation.rounds })}
                </span>
              </div>
            </div>
          </Card>
        ) : null}

        <div>
          <p className="text-card text-text-1 break-words">{detail.serviceTitle}</p>
          <p className="text-label text-text-2 mt-s1">
            {t("detail.priceLineWithArea", {
              amount: formatMoney(detail.amountPaise),
              method: detail.payment.methodLabel,
              area: detail.area,
            })}
          </p>
          <p className="text-caption text-text-3 mt-s1">
            {t("detail.created", { value: formatDateTime(detail.createdAt) })}
          </p>
        </div>

        <RecordSection label={t("section.customer")}>
          <p className="text-emph text-text-1 break-words">{detail.customer.name}</p>
          <MonoText className="text-text-2">{formatPhone(detail.customer.phone)}</MonoText>
          <p className="text-label text-text-2 mt-s1">{detail.customer.address}</p>
        </RecordSection>

        <Card tone="surface" density="tight">
          <RecordSection label={t("section.provider")}>
            {detail.provider ? (
              <p className="text-emph text-text-1">{detail.provider.name}</p>
            ) : (
              <p className="text-emph text-danger">
                {t("detail.dispatchSummaryInline", {
                  rounds: detail.dispatchRounds.length,
                  declined: detail.declinedTotal,
                })}
              </p>
            )}
          </RecordSection>
        </Card>

        <RecordSection label={t("section.dispatchRounds")}>
          <Timeline
            label={t("section.dispatchRounds")}
            entries={dispatchRoundEntries(detail.timeline)}
          />
        </RecordSection>
      </div>
    </Panel>
  );
}
