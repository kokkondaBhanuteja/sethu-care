import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { TextInput } from "../../components/ui/form/TextInput";
import { IDLE_LOCK_MINUTES } from "./auth.constants";
import type { UseSessionLockResult } from "./useSessionLock";

export interface SessionLockDesktopProps {
  lock: UseSessionLockResult;
}

/**
 * The idle lock (design BOX 58).
 *
 * Not dismissible: there is no close control and no scrim-click exit, because there is nothing safe
 * to return to underneath it. The account is named — an admin returning to a locked machine in a
 * shared ops room needs to know whose session they are about to type a password into.
 */
export function SessionLockDesktop({ lock }: SessionLockDesktopProps) {
  const { t } = useTranslation("adminAuth");

  return (
    <Modal
      isOpen
      isDismissable={false}
      width="confirm"
      title={t("lock.title")}
      onDismiss={() => undefined}
    >
      <form onSubmit={lock.form.handleSubmit} className="flex flex-col items-center gap-s3">
        <Icon glyph={Lock} size="empty" className="text-text-2" />

        <p className="text-center text-body text-text-2">
          {t("lock.body", { minutes: IDLE_LOCK_MINUTES })}
        </p>
        <p className="text-label text-text-3">{lock.accountLine}</p>

        <div className="mt-s2 w-full">
          <TextInput
            label={t("lock.passwordLabel")}
            labelStyle="plain"
            type="password"
            autoComplete="current-password"
            error={lock.errorMessage ?? lock.form.errorFor("password")}
            {...lock.form.form.register("password")}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="primary"
          block
          className="text-body"
          isLoading={lock.form.isSubmitting}
        >
          {lock.form.isSubmitting ? t("lock.unlocking") : t("lock.unlock")}
        </Button>

        <Button variant="text" size="secondary" className="text-body" onClick={lock.signOut}>
          {t("lock.signOutInstead")}
        </Button>
      </form>
    </Modal>
  );
}
