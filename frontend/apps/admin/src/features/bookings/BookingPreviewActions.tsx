import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { BookingActionButtons } from "./BookingActionButtons";
import type { BookingActionSet } from "./useBookingActions";

export interface BookingPreviewActionsProps {
  actions: BookingActionSet;
}

/** True when the preview has a footer to draw — the panel/drawer omit the footer chrome otherwise. */
export function hasPreviewActions(actions: BookingActionSet): boolean {
  return actions.canAcknowledge || actions.primary !== null;
}

/**
 * The preview offers only the decision this record is usually opened to make; everything else
 * lives on the full record, one click away (design BOX 15). Shared by the side panel and the
 * drawer so both surfaces keep the same one-decision budget.
 */
export function BookingPreviewActions({ actions }: BookingPreviewActionsProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div className="flex items-center gap-s3">
      {actions.canAcknowledge ? (
        <Button variant="primary" size="section" block>
          {t("actions.acknowledge")}
        </Button>
      ) : null}
      {actions.primary ? (
        <BookingActionButtons actions={[actions.primary]} size="section" block />
      ) : null}
    </div>
  );
}
