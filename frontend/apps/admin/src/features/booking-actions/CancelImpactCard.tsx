import { IndianRupee, MessageCircle, UserX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { formatMoney } from "../../lib/format";
import type { CancelContext } from "./booking-actions.types";

export interface CancelImpactCardProps {
  context: CancelContext;
}

/**
 * Consequence first, form second. Three rows, one per party the action moves, each with its own
 * icon so the card scans as "customer / technician / money" before it is read.
 */
export function CancelImpactCard({ context }: CancelImpactCardProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <Card tone="danger" edge="danger">
      <p className="text-emph text-danger">{t("cancel.impactTitle")}</p>

      <ul className="mt-s3 flex flex-col gap-s2">
        <li className="flex items-center gap-s2">
          <Icon glyph={MessageCircle} className="text-danger" />
          <span className="text-label text-text-1">
            {t("cancel.impactCustomer", { name: context.booking.customerName })}
          </span>
        </li>
        {context.booking.providerName ? (
          <li className="flex items-center gap-s2">
            <Icon glyph={UserX} className="text-danger" />
            <span className="text-label text-text-1">
              {t("cancel.impactProvider", { name: context.booking.providerName })}
            </span>
          </li>
        ) : null}
        <li className="flex items-center gap-s2">
          <Icon glyph={IndianRupee} className="text-danger" />
          <span className="text-label text-text-1">
            {t("cancel.impactRefund", { amount: formatMoney(context.policyRefundPaise) })}
          </span>
        </li>
      </ul>
    </Card>
  );
}
