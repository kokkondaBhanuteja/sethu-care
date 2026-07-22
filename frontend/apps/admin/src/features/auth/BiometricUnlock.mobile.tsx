import { Fingerprint } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { AuthLayout, AUTH_FRAMES } from "../../layouts/AuthLayout";
import { PASSCODE_LENGTH } from "./auth.constants";
import { CodeInput } from "../../components/ui/form/CodeInput";
import type { UseUnlockResult } from "./useUnlock";

export interface BiometricUnlockMobileProps {
  unlock: UseUnlockResult;
}

/**
 * The screen an admin sees every single day (design BOX 92–94), so a single extra tap is worth
 * arguing about: the sensor is the primary action and the card carries no primary button at all
 * until the sensor has refused, at which point "Use passcode" is promoted — a wet or cold thumb
 * will fail the second time too.
 */
export function BiometricUnlockMobile({ unlock }: BiometricUnlockMobileProps) {
  const { t } = useTranslation("adminAuth");
  const hasRefused = unlock.phase === "refused";

  const signOutLink = (
    <Button variant="text" size="secondary" className="text-text-on-dark" onClick={unlock.signOut}>
      {t("unlock.signOut")}
    </Button>
  );

  if (unlock.phase === "passcode") {
    return (
      <AuthLayout frame={AUTH_FRAMES.lock} below={signOutLink}>
        {/*
          The passcode field takes the fingerprint's slot so the card neither moves nor resizes.
          "Unlock to continue" is gone: stacking two headings around the cells would read as a
          rendering fault rather than as the same card in a second mode.
        */}
        <div className="text-card text-text-1">{t("unlock.passcodeTitle")}</div>

        <CodeInput
          value={unlock.passcode}
          onChange={unlock.setPasscode}
          onComplete={unlock.submitPasscode}
          length={PASSCODE_LENGTH}
          label={t("unlock.passcodeLabel")}
          size="passcode"
          // Entered digits show as dots, never as figures: an unlock passcode is a secret,
          // whereas a two-factor code is not.
          masked
          invalid={Boolean(unlock.passcodeError)}
          disabled={unlock.isCheckingPasscode}
          focusToken={unlock.focusToken}
        />

        {unlock.passcodeError ? (
          <div role="alert" className="text-label text-danger">
            {unlock.passcodeError}
          </div>
        ) : null}

        <div className="text-label text-text-2">{unlock.accountLine}</div>

        <Button
          variant="primary"
          size="secondary"
          block
          className="mt-s1"
          isLoading={unlock.isCheckingPasscode}
          disabled={unlock.passcode.length < PASSCODE_LENGTH}
          onClick={unlock.submitPasscode}
        >
          {t("lock.unlock")}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout frame={AUTH_FRAMES.lock} below={signOutLink}>
      <Icon
        glyph={Fingerprint}
        size="hero"
        className={hasRefused ? "text-danger" : "text-brand"}
        label={t("unlock.prompt")}
      />

      <div className="text-section text-text-1">{t("unlock.title")}</div>
      <div className="text-label text-text-2">{unlock.accountLine}</div>

      {unlock.message ? (
        <div role="alert" className="text-label text-danger">
          {unlock.message}
        </div>
      ) : null}

      {hasRefused ? (
        <Button variant="text" size="secondary" block onClick={unlock.retryBiometric}>
          {t("unlock.tryAgain")}
        </Button>
      ) : null}

      <Button
        variant={hasRefused ? "primary" : "outline"}
        size="secondary"
        block
        className="mt-s1 font-semibold"
        onClick={unlock.showPasscode}
      >
        {t("unlock.usePasscode")}
      </Button>
    </AuthLayout>
  );
}
