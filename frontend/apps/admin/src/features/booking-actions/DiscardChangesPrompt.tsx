import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Sheet } from "../../components/ui/Sheet";

export interface DiscardChangesPromptProps {
  isOpen: boolean;
  isDesktop: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

/** The §3.3 exit guard. Raised by `useDiscardGuard`, never rendered unconditionally. */
export function DiscardChangesPrompt({
  isOpen,
  isDesktop,
  onDiscard,
  onKeepEditing,
}: DiscardChangesPromptProps) {
  const { t } = useTranslation("adminBookingActions");
  const title = t("discard.title");
  const body = <p className="text-body text-text-2">{t("discard.body")}</p>;

  if (isDesktop) {
    return (
      <Modal
        isOpen={isOpen}
        title={title}
        width="confirm"
        onDismiss={onKeepEditing}
        footer={
          <>
            <Button variant="text" size="section" onClick={onKeepEditing}>
              {t("discard.keepEditing")}
            </Button>
            <Button variant="danger" size="section" onClick={onDiscard}>
              {t("discard.discard")}
            </Button>
          </>
        }
      >
        {body}
      </Modal>
    );
  }

  return (
    <Sheet isOpen={isOpen} title={title} onDismiss={onKeepEditing}>
      <div className="flex flex-col gap-s4">
        {body}
        <div className="flex flex-col gap-s1">
          <Button variant="danger" size="primary" block onClick={onDiscard}>
            {t("discard.discard")}
          </Button>
          <Button variant="text" size="secondary" block onClick={onKeepEditing}>
            {t("discard.keepEditing")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
