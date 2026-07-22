import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Sheet } from "../../components/ui/Sheet";
import { useIsDesktop } from "../../hooks/useBreakpoint";
import { useSignOut } from "./useSignOut";

export interface SignOutConfirmProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/**
 * BOX 67 (desktop modal) / BOX 96 (mobile sheet).
 *
 * The confirm exists because of the queued actions: the count is the one phrase in danger ink inside
 * otherwise secondary copy, and the button says "discard" so nobody presses it expecting the queue
 * to survive (spec §6.22).
 */
export function SignOutConfirm({ isOpen, onDismiss }: SignOutConfirmProps) {
  const { t } = useTranslation("adminSettings");
  const shellT = useTranslation("adminShell").t;
  const isDesktop = useIsDesktop();
  const { queuedActions, isSigningOut, signOut } = useSignOut();

  const hasQueue = queuedActions > 0;
  const body = hasQueue ? (
    <p className="text-body text-text-2">
      {t("signOut.bodyQueuedPrefix")}
      <span className="font-semibold text-danger">
        {t("signOut.queuedCount", { count: queuedActions })}
      </span>
      {t("signOut.bodyQueuedSuffix")}
    </p>
  ) : (
    <p className="text-body text-text-2">{t("signOut.bodyPlain")}</p>
  );

  const confirmLabel = hasQueue ? t("signOut.confirmQueued") : t("signOut.confirm");

  if (isDesktop) {
    return (
      <Modal
        isOpen={isOpen}
        title={t("signOut.title")}
        width="confirm"
        onDismiss={onDismiss}
        footer={
          <>
            <Button variant="text" size="section" onClick={onDismiss}>
              {shellT("actions.cancel")}
            </Button>
            <Button
              variant="danger"
              size="section"
              isLoading={isSigningOut}
              onClick={() => void signOut()}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {body}
      </Modal>
    );
  }

  return (
    <Sheet
      isOpen={isOpen}
      title={t("signOut.title")}
      onDismiss={onDismiss}
      footer={
        <div className="flex flex-col gap-s2">
          <Button
            variant="danger"
            size="primary"
            block
            isLoading={isSigningOut}
            onClick={() => void signOut()}
          >
            {confirmLabel}
          </Button>
          <Button variant="text" size="secondary" block onClick={onDismiss}>
            {shellT("actions.cancel")}
          </Button>
        </div>
      }
    >
      {body}
    </Sheet>
  );
}
