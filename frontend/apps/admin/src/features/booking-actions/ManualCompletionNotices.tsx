import { CircleCheckBig, Shield } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { formatTime } from "../../lib/format";

/**
 * Pinned above the scroll region at every step: the bypass warning has to be true at every scroll
 * position, not just on entry.
 */
export function ManualCompletionBypassNotice() {
  const { t } = useTranslation("adminBookingActions");

  return (
    <Banner
      tone="warning"
      icon={Shield}
      title={t("manual.bypassTitle")}
      detail={t("manual.bypassBody")}
    />
  );
}

export interface OtpArrivedInterruptProps {
  isOpen: boolean;
  customerName: string;
  verifiedAtIso: string;
  onViewBooking: () => void;
}

/**
 * The customer verified mid-flow, so the manual path yields to the verified one (spec §7.3). It
 * interrupts rather than waiting for the end, because every further step is wasted work on a
 * booking that has already closed itself — and there is deliberately no "Continue anyway".
 */
export function OtpArrivedInterrupt({
  isOpen,
  customerName,
  verifiedAtIso,
  onViewBooking,
}: OtpArrivedInterruptProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <Modal
      isOpen={isOpen}
      width="confirm"
      isDismissable={false}
      title={t("manual.otpArrivedTitle")}
      onDismiss={onViewBooking}
      footer={
        <Button variant="primary" size="primary" block onClick={onViewBooking}>
          {t("manual.viewBooking")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-s3 text-center">
        <Icon glyph={CircleCheckBig} size="empty" className="text-success" />
        <p className="text-body text-text-2">
          {t("manual.otpArrivedBody", {
            name: customerName,
            time: formatTime(verifiedAtIso),
          })}
        </p>
      </div>
    </Modal>
  );
}

export interface ManualCompletionTooEarlyProps {
  availableInMinutes: number;
  onBack: () => void;
}

/**
 * The 30-minute lock (spec §6.14) still holds. It names its own unlock time rather than hiding the
 * action: a hidden control teaches nothing and gets hunted for, and the delay is policy — it forces
 * the normal OTP path to be genuinely exhausted first.
 */
export function ManualCompletionTooEarly({
  availableInMinutes,
  onBack,
}: ManualCompletionTooEarlyProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <EmptyState
      icon={Shield}
      title={t("manual.tooEarlyTitle", { minutes: availableInMinutes })}
      body={t("manual.tooEarlyBody")}
      grow
      actions={
        <Button variant="outline" size="secondary" onClick={onBack}>
          {t("manual.backToBooking")}
        </Button>
      }
    />
  );
}
