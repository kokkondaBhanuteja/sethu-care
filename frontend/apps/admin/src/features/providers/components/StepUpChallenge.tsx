import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { TextInput } from "../../../components/ui/form/TextInput";
import type { StepUpState } from "../../../hooks/useStepUp";

/** Any non-empty passcode passes in mock mode; the real gate is the native biometric plugin. */
const MIN_PASSCODE_LENGTH = 4;

export interface StepUpChallengeProps {
  stepUp: StepUpState;
}

/**
 * The fresh-verification challenge for high and critical actions (spec §5.5). It is deliberately
 * not a tap-to-confirm dialog: operators learn to dismiss those reflexively, which is exactly the
 * habit a suspension or a rejection must not be able to ride.
 */
export function StepUpChallenge({ stepUp }: StepUpChallengeProps) {
  const { t } = useTranslation("adminShell");
  const [passcode, setPasscode] = useState("");

  function handleCancel() {
    setPasscode("");
    stepUp.cancel();
  }

  function handleConfirm() {
    setPasscode("");
    stepUp.confirm();
  }

  return (
    <Modal
      isOpen={stepUp.isChallenging}
      title={t("stepUp.title")}
      subtitle={t("stepUp.body")}
      width="confirm"
      onDismiss={handleCancel}
      footer={
        <>
          <Button variant="text" onClick={handleCancel}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={passcode.length < MIN_PASSCODE_LENGTH}
            onClick={handleConfirm}
          >
            {t("stepUp.verify")}
          </Button>
        </>
      }
    >
      <TextInput
        label={t("stepUp.passcodeLabel")}
        type="password"
        autoComplete="one-time-code"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
      />
    </Modal>
  );
}
