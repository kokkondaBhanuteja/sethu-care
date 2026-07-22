import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { AuthLayout } from "../../layouts/AuthLayout";
import { DeviceLimitPicker } from "./DeviceLimitPicker";
import { OtpFields } from "./OtpFields";
import type { UseOtpVerifyResult } from "./useOtpVerify";

export interface OtpScreenDesktopProps {
  otp: UseOtpVerifyResult;
}

/**
 * Two-factor on desktop (design BOX 55–57).
 *
 * The split is identical to login's — same 55% flat brand panel, same wordmark, same two lines low
 * in it — so continuing from password to code feels like one door rather than two. Only the 360px
 * column changes.
 */
export function OtpScreenDesktop({ otp }: OtpScreenDesktopProps) {
  const { t } = useTranslation("adminAuth");
  const { t: tShell } = useTranslation("adminShell");

  const panel = {
    wordmark: t("brand.wordmark"),
    headline: t("brand.panelHeadline"),
    tagline: t("brand.panelTagline"),
  };

  if (otp.phase === "deviceLimit") {
    return (
      <AuthLayout panel={panel}>
        <DeviceLimitPicker
          devices={otp.devices}
          onRevoke={otp.revokeDevice}
          revokingDeviceId={otp.revokingDeviceId}
          onCancel={otp.goBack}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout panel={panel}>
      <div className="-ml-s3 flex items-center gap-s1">
        <Button
          variant="text"
          size="secondary"
          iconStart={ChevronLeft}
          aria-label={tShell("actions.back")}
          onClick={otp.goBack}
        />
        <h1 className="text-title text-text-1">{t("otp.title")}</h1>
      </div>

      <OtpFields otp={otp} size="desktop" />
    </AuthLayout>
  );
}
