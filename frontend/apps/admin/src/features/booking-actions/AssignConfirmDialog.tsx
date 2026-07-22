import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { AssignConfirmBody } from "./AssignConfirmBody";
import type { BookingActionSubject, ProviderCandidate } from "./booking-actions.types";

export interface AssignConfirmDialogProps {
  candidate: ProviderCandidate | null;
  booking: BookingActionSubject;
  isSubmitting: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The desktop chrome around `AssignConfirmBody`. Desktop used to commit on the row's one click —
 * no ETA, no "customer will be notified", no busy warning — which is how an on-job technician gets
 * double-booked with zero signals. The confirm step is the same one mobile shows (anti-drift,
 * spec §2.1), composed as a dialog over the candidate table.
 */
export function AssignConfirmDialog({
  candidate,
  booking,
  isSubmitting,
  onConfirm,
  onDismiss,
}: AssignConfirmDialogProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  if (!candidate) return null;

  return (
    <Modal
      isOpen
      width="confirm"
      title={t("assign.confirmTitle", { name: candidate.name })}
      isDismissable={!isSubmitting}
      onDismiss={onDismiss}
      footer={
        <>
          <Button variant="text" size="section" onClick={onDismiss}>
            {tShell("actions.cancel")}
          </Button>
          {/* NOT destructive-red: a legitimate override ops makes several times a day (see the
              mobile sheet's identical reasoning). */}
          <Button variant="primary" size="section" isLoading={isSubmitting} onClick={onConfirm}>
            {t("assign.assign")}
          </Button>
        </>
      }
    >
      <AssignConfirmBody candidate={candidate} booking={booking} />
    </Modal>
  );
}
