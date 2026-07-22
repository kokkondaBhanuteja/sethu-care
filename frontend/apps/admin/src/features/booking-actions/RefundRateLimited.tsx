import { Clock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../../components/ui/EmptyState";
import { formatTime } from "../../lib/format";

export interface RefundRateLimitedProps {
  allowedPerHour: number;
  resetsAtIso: string | null;
}

/**
 * The hourly ceiling is spent, so the whole form is replaced rather than disabled field by field: a
 * greyed-out form invites the operator to keep trying, an empty state ends the attempt.
 *
 * The copy names the limit as a fraud control and gives the exact reset time. A control that reads
 * as a bug gets escalated to engineering; one that names itself gets understood and waited out.
 */
export function RefundRateLimited({ allowedPerHour, resetsAtIso }: RefundRateLimitedProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <EmptyState
      icon={Clock}
      title={t("refund.rateLimitedTitle")}
      body={
        resetsAtIso
          ? t("refund.rateLimitedBody", {
              count: allowedPerHour,
              time: formatTime(resetsAtIso),
            })
          : t("refund.rateLimitedBodyNoReset", { count: allowedPerHour })
      }
      grow
    />
  );
}
