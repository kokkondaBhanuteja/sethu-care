import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";

export interface DiscardChangesDialogProps {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * "Discard changes?" — the guard on backing out of a half-entered destructive flow (spec §3.4).
 * Both shells use the modal: on mobile the flow owns the whole screen, so a bottom sheet would
 * hand the thumb an accidental dismissal of the very prompt that exists to prevent one.
 */
export function DiscardChangesDialog({
  isOpen,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Modal
      isOpen={isOpen}
      title={t("suspend.discardTitle")}
      width="confirm"
      onDismiss={onKeepEditing}
      footer={
        <>
          <Button variant="text" onClick={onKeepEditing}>
            {t("suspend.discardCancel")}
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            {t("suspend.discardConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-1">{t("suspend.discardBody")}</p>
    </Modal>
  );
}
