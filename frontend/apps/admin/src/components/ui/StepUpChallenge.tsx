import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { useIsDesktop } from "../../hooks/useBreakpoint";
import type { StepUpState } from "../../hooks/useStepUp";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Sheet } from "./Sheet";
import { TextInput } from "./form/TextInput";

/** A passcode shorter than this is a slip, not an attempt. The real gate is server-side. */
const MIN_PASSCODE_LENGTH = 4;

export interface StepUpChallengeProps {
  /** From `useStepUp(action)`. It owns the 60-second window; this only collects the proof. */
  stepUp: StepUpState;
  /** "Confirm cancellation" / "Confirm refund". Falls back to the generic title. */
  title?: string;
  /** The facts being committed, restated because the operator's eyes have left the form. */
  summary?: string;
  /** Red for a cancellation or a rejection, brand for a refund — the commit keeps its own tone. */
  tone?: "danger" | "brand";
  confirmLabel?: string;
  /** Shown verbatim before the commit — the refund's customer notification, for example. */
  preview?: { readonly label: string; readonly body: string };
}

/**
 * Fresh verification for a high- or critical-risk action (spec §5.5).
 *
 * Deliberately NOT a tap-to-confirm dialog: operators learn to dismiss those reflexively, and that
 * habit is exactly what a cancellation, a refund or a rejection must not be able to ride. Whether a
 * challenge is needed at all is the action registry's decision, not this component's.
 *
 * NATIVE BIOMETRIC INTEGRATION POINT — on iOS and Android this should call a Capacitor biometric
 * plugin and fall through to the passcode field only when biometrics are unavailable or refused. No
 * such plugin is installed, so the passcode path is the whole implementation today and the copy
 * says so rather than promising a fingerprint prompt that will never appear.
 */
export function StepUpChallenge({
  stepUp,
  title,
  summary,
  tone = "danger",
  confirmLabel,
  preview,
}: StepUpChallengeProps) {
  const { t } = useTranslation("adminShell");
  const isDesktop = useIsDesktop();
  const [passcode, setPasscode] = useState("");

  const heading = title ?? t("stepUp.title");
  const commitLabel = confirmLabel ?? t("stepUp.verify");
  const isBlocked = passcode.length < MIN_PASSCODE_LENGTH;

  function reset() {
    setPasscode("");
  }

  function handleCancel() {
    reset();
    stepUp.cancel();
  }

  function handleConfirm() {
    reset();
    stepUp.confirm();
  }

  const body = (
    <div className="flex flex-col items-center gap-s4 text-center">
      <Icon glyph={Fingerprint} size="hero" className="text-brand" />
      {summary ? (
        <Card tone="surface" density="tight" className="w-full text-left">
          <span className="text-label text-text-1">{summary}</span>
        </Card>
      ) : null}

      {preview ? (
        <div className="w-full text-left">
          <p className="mb-s2 text-pill text-text-3">{preview.label}</p>
          <div className="rounded-card border border-border-subtle bg-canvas p-s3">
            <span className="text-label text-text-1">{preview.body}</span>
          </div>
        </div>
      ) : null}

      <p className="text-body text-text-2">{t("stepUp.body")}</p>

      <div className="w-full text-left">
        <TextInput
          label={t("stepUp.passcodeLabel")}
          type="password"
          autoComplete="current-password"
          inputMode="numeric"
          value={passcode}
          hint={t("stepUp.biometricUnavailable")}
          onChange={(event) => setPasscode(event.target.value)}
        />
      </div>
    </div>
  );

  const commitVariant = tone === "danger" ? "danger" : "primary";

  if (isDesktop) {
    return (
      <Modal
        isOpen={stepUp.isChallenging}
        title={heading}
        width="confirm"
        onDismiss={handleCancel}
        footer={
          <>
            <Button variant="text" size="section" onClick={handleCancel}>
              {t("actions.cancel")}
            </Button>
            <Button
              variant={commitVariant}
              size="section"
              disabled={isBlocked}
              onClick={handleConfirm}
            >
              {commitLabel}
            </Button>
          </>
        }
      >
        {body}
      </Modal>
    );
  }

  return (
    <Sheet isOpen={stepUp.isChallenging} title={heading} onDismiss={handleCancel}>
      <div className="flex flex-col gap-s4">
        {body}
        <div className="flex flex-col gap-s1">
          <Button
            variant={commitVariant}
            size="primary"
            block
            disabled={isBlocked}
            onClick={handleConfirm}
          >
            {commitLabel}
          </Button>
          <Button variant="text" size="secondary" block onClick={handleCancel}>
            {t("actions.cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
