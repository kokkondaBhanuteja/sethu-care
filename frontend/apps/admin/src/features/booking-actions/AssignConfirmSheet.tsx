import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { AssignConfirmBody } from "./AssignConfirmBody";
import type { BookingActionSubject, ProviderCandidate } from "./booking-actions.types";

export interface AssignConfirmSheetProps {
  candidate: ProviderCandidate | null;
  booking: BookingActionSubject;
  isSubmitting: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The mobile chrome around `AssignConfirmBody` — the only confirmation in the assign flow, so it
 * earns its interruption by restating the pairing rather than asking "Are you sure?".
 */
export function AssignConfirmSheet({
  candidate,
  booking,
  isSubmitting,
  onConfirm,
  onDismiss,
}: AssignConfirmSheetProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  if (!candidate) return null;

  const title = t("assign.confirmTitle", { name: candidate.name });

  return (
    <Sheet isOpen title={title} hideTitle onDismiss={onDismiss}>
      <div className="flex flex-col gap-s3">
        <h2 className="text-section text-text-1">{title}</h2>

        <AssignConfirmBody candidate={candidate} booking={booking} />

        <div className="flex flex-col gap-s1">
          {/* Deliberately NOT recoloured as destructive: this is a legitimate override ops makes
              several times a day, and dressing it up in red teaches the colour to be ignored. */}
          <Button
            variant="primary"
            size="primary"
            block
            isLoading={isSubmitting}
            onClick={onConfirm}
          >
            {t("assign.assign")}
          </Button>
          <Button variant="text" size="secondary" block onClick={onDismiss}>
            {tShell("actions.cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
