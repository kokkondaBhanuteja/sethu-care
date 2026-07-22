import { UserRoundX, WifiOff, Zap } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ROUTES } from "../../routes/routes.constants";

export interface AssignEmptyStateProps {
  bookingId: string;
  /** Mobile stacks the two ways out; desktop sets them side by side inside the modal. */
  stacked?: boolean;
}

/**
 * The dead end, and the one empty state in this product that must not be calm. Both offered moves
 * are re-runs of the automation — this product never lets an admin choose whom the system contacts.
 * "Cancel booking and refund" is a red text link, never a third button: it is right about one time
 * in twenty and costs the customer their afternoon, so it is findable and never convenient.
 */
export function AssignNoCandidates({ bookingId, stacked = false }: AssignEmptyStateProps) {
  const { t } = useTranslation("adminBookingActions");
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={UserRoundX}
      title={t("assign.emptyTitle")}
      body={t("assign.emptyBody")}
      grow
      actions={
        <div className="flex w-full flex-col items-center gap-s2">
          <div className={stacked ? "flex w-full flex-col gap-s2" : "flex gap-s2"}>
            <Button
              variant="primary"
              size={stacked ? "primary" : "section"}
              block={stacked}
              onClick={() => void navigate(ROUTES.bookingRedispatch(bookingId))}
            >
              {t("assign.widenRadius")}
            </Button>
            <Button
              variant="outline"
              size={stacked ? "primary" : "section"}
              block={stacked}
              iconStart={Zap}
              onClick={() => void navigate(ROUTES.bookingRedispatch(bookingId))}
            >
              {t("assign.redispatchWithIncentive")}
            </Button>
          </div>
          <Button
            variant="textDanger"
            size="section"
            onClick={() => void navigate(ROUTES.bookingCancel(bookingId))}
          >
            {t("assign.cancelAndRefund")}
          </Button>
        </div>
      }
    />
  );
}

/**
 * Blocked, not degraded. A stale candidate list is worse than none — assigning from a three-minute
 * -old snapshot double-books a technician — so no list is rendered at all and the copy names that
 * consequence rather than the network condition (spec §6.10).
 */
export function AssignBlockedOffline() {
  const { t } = useTranslation("adminBookingActions");

  return (
    <EmptyState
      icon={WifiOff}
      title={t("assign.offlineTitle")}
      body={t("assign.offlineBody")}
      grow
    />
  );
}
