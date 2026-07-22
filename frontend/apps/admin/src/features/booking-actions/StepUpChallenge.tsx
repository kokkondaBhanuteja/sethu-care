import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { Sheet } from "../../components/ui/Sheet";
import { TextInput } from "../../components/ui/form/TextInput";

export interface StepUpChallengeProps {
  isOpen: boolean;
  isDesktop: boolean;
  /** "Confirm cancellation" / "Confirm refund" — the design titles each flow's challenge. */
  title: string;
  /** The facts being committed, restated once more because the eyes have left the form. */
  summary: string;
  /** Red for a cancellation, brand for a refund — the commit keeps its own tone. */
  tone: "danger" | "brand";
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Fresh verification for a high- or critical-risk action (spec §5.5). It is NOT a confirm dialog:
 * `useStepUp` decides whether it is needed and holds the 60-second window; this component only
 * collects the proof.
 *
 * NATIVE BIOMETRIC INTEGRATION POINT — on iOS and Android this challenge should call a Capacitor
 * biometric plugin and fall through to the passcode field only when biometrics are unavailable or
 * refused. No such plugin is installed, so the passcode path is the whole implementation today and
 * the copy says so rather than promising a fingerprint prompt that will never appear.
 */
export function StepUpChallenge({
  isOpen,
  isDesktop,
  title,
  summary,
  tone,
  confirmLabel,
  onConfirm,
  onCancel,
}: StepUpChallengeProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const [passcode, setPasscode] = useState("");

  const body = (
    <div className="flex flex-col items-center gap-s4 text-center">
      <Icon glyph={Fingerprint} size="hero" className="text-brand" />
      <p className="text-section font-semibold text-text-1">{title}</p>

      <Card tone="surface" density="tight" className="w-full text-left">
        <span className="text-label text-text-1">{summary}</span>
      </Card>

      <p className="text-body text-text-2">{t("stepUp.body")}</p>

      <div className="w-full text-left">
        <TextInput
          label={tShell("stepUp.passcodeLabel")}
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
  const isBlocked = passcode.length === 0;

  if (isDesktop) {
    return (
      <Modal
        isOpen={isOpen}
        title={title}
        width="compact"
        onDismiss={onCancel}
        footer={
          <>
            <Button variant="text" size="section" onClick={onCancel}>
              {tShell("actions.cancel")}
            </Button>
            <Button variant={commitVariant} size="section" disabled={isBlocked} onClick={onConfirm}>
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
    <Sheet isOpen={isOpen} title={title} hideTitle onDismiss={onCancel}>
      <div className="flex flex-col gap-s4">
        {body}
        <div className="flex flex-col gap-s1">
          <Button
            variant={commitVariant}
            size="primary"
            block
            disabled={isBlocked}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="text" size="secondary" block onClick={onCancel}>
            {tShell("actions.cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
