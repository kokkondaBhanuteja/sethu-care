import { useIsDesktop } from "../hooks/useBreakpoint";
import { OtpScreenDesktop } from "../features/auth/OtpScreen.desktop";
import { OtpScreenMobile } from "../features/auth/OtpScreen.mobile";
import { useOtpVerify } from "../features/auth/useOtpVerify";

/**
 * `/login/otp` — the second factor (spec §6.3). The two shells genuinely differ: desktop keeps the
 * title in the 360px column, mobile pushes it into an app bar. The rules are shared by useOtpVerify.
 */
export default function OtpPage() {
  const isDesktop = useIsDesktop();
  const otp = useOtpVerify();

  return isDesktop ? <OtpScreenDesktop otp={otp} /> : <OtpScreenMobile otp={otp} />;
}
