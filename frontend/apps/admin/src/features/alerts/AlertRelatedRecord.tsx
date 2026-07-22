import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatMoney } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { isBooking } from "./alerts.links";
import type { RelatedRecord } from "./alerts.types";

export interface AlertRelatedRecordProps {
  record: RelatedRecord;
  /** The severity rail is dropped on informational alerts — nothing about them is urgent. */
  showEdge?: boolean;
}

/** The record the alert is about, as a link. This screen navigates; it never acts (spec §6.21). */
export function AlertRelatedRecord({ record, showEdge = true }: AlertRelatedRecordProps) {
  const to = isBooking(record.kind)
    ? ROUTES.bookingDetail(record.id)
    : ROUTES.providerDetail(record.id);

  return (
    <Link to={to} className="block no-underline">
      <Card edge={showEdge ? "danger" : "none"}>
        <div className="flex items-start gap-s3">
          <div className="grow">
            <div className="flex flex-wrap items-center gap-s2">
              <Pill tone={record.statusTone}>{record.statusLabel}</Pill>
              <span className="font-mono text-mono text-text-2 tabular-nums">
                {record.reference}
              </span>
            </div>
            <p className="mt-s2 mb-0 text-emph text-text-1">{record.title}</p>
            <p className="mt-s1 mb-0 text-label text-text-2">
              {record.amountPaise === null
                ? record.subtitle
                : `${record.subtitle} · ${formatMoney(record.amountPaise)}`}
            </p>
            <p className="mt-s1 mb-0 text-caption text-text-3">{record.createdLine}</p>
          </div>
          <Icon glyph={ChevronRight} className="shrink-0 self-center text-text-3" />
        </div>
      </Card>
    </Link>
  );
}
