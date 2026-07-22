import { useTranslation } from "@sethu/i18n";

import { AuthLayout } from "../../layouts/AuthLayout";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { DeviceLimitPicker } from "./DeviceLimitPicker";
import { OtpFields } from "./OtpFields";
import type { UseOtpVerifyResult } from "./useOtpVerify";

export interface OtpScreenMobileProps {
  otp: UseOtpVerifyResult;
}

/**
 * Two-factor on a phone (design BOX 88–91).
 *
 * A pushed screen with an app bar rather than desktop's in-column title, and no tab bar: this sits
 * pre-auth, so there is nothing to navigate to yet.
 */
export function OtpScreenMobile({ otp }: OtpScreenMobileProps) {
  const { t } = useTranslation("adminAuth");

  if (otp.phase === "deviceLimit") {
    return (
      <AuthLayout>
        <div className="pt-s8">
          <DeviceLimitPicker
            devices={otp.devices}
            onRevoke={otp.revokeDevice}
            revokingDeviceId={otp.revokingDeviceId}
            onCancel={otp.goBack}
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout header={<MobileAppBar title={t("otp.title")} showBack onBack={otp.goBack} />}>
      <OtpFields otp={otp} size="mobile" />
    </AuthLayout>
  );
}
