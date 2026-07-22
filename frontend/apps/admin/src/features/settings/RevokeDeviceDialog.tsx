import { TriangleAlert } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { TextInput } from "../../components/ui/form/TextInput";
import { useAppForm } from "../../lib/forms/useAppForm";
import type { TrustedDevice } from "./settings.types";

const revokeSchema = z.object({ password: z.string().min(1) });
type RevokeValues = z.infer<typeof revokeSchema>;

export interface RevokeDeviceDialogProps {
  device: TrustedDevice | null;
  isRevoking: boolean;
  onConfirm: (device: TrustedDevice) => void;
  onDismiss: () => void;
}

/**
 * BOX 63 / 102. A centred modal on both surfaces, because this action ends the session the admin is
 * standing in rather than sliding in beside a list.
 *
 * The password field IS the step-up the action registry demands for `device.revoke` — the design
 * draws a password on desktop and a fingerprint on mobile, and on native the Capacitor biometric
 * prompt replaces this field. The confirm button names the consequence rather than repeating the
 * verb, so nobody presses "Revoke" expecting to stay signed in.
 */
export function RevokeDeviceDialog({
  device,
  isRevoking,
  onConfirm,
  onDismiss,
}: RevokeDeviceDialogProps) {
  const { t } = useTranslation("adminSettings");
  const shellT = useTranslation("adminShell").t;
  const isCurrent = device?.isCurrent ?? false;

  const { form, handleSubmit, isSubmitting, errorFor } = useAppForm<RevokeValues>({
    schema: revokeSchema,
    defaultValues: { password: "" },
    onSubmit: async () => {
      if (device) onConfirm(device);
    },
  });

  return (
    <Modal
      isOpen={device !== null}
      title={isCurrent ? t("security.revokeCurrentTitle") : t("security.revokeOtherTitle")}
      width="compact"
      onDismiss={onDismiss}
      footer={
        <>
          <Button variant="text" size="section" onClick={onDismiss}>
            {shellT("actions.cancel")}
          </Button>
          <Button
            variant="danger"
            size="section"
            isLoading={isSubmitting || isRevoking}
            onClick={() => void handleSubmit()}
          >
            {isCurrent ? t("security.revokeCurrentConfirm") : t("security.revoke")}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-s4" onSubmit={(event) => void handleSubmit(event)}>
        <Icon glyph={TriangleAlert} size="empty" className="text-danger" />
        <p className="text-body text-text-2">
          {isCurrent
            ? t("security.revokeCurrentBody")
            : t("security.revokeOtherBody", { device: device?.name ?? "" })}
        </p>
        <TextInput
          type="password"
          autoComplete="current-password"
          label={t("security.passwordLabel")}
          placeholder={t("security.passwordPlaceholder")}
          labelStyle="plain"
          required
          {...(errorFor("password") ? { error: t("security.passwordRequired") } : {})}
          {...form.register("password")}
        />
      </form>
    </Modal>
  );
}
