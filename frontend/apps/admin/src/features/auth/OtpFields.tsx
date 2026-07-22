import { CircleAlert, Clock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Checkbox } from "../../components/ui/form/Checkbox";
import { OTP_LENGTH } from "./auth.constants";
import { CodeInput, type CodeInputSize } from "./CodeInput";
import type { UseOtpVerifyResult } from "./useOtpVerify";

export interface OtpFieldsProps {
  otp: UseOtpVerifyResult;
  /** Desktop cells are 56x60, mobile's 48x56 — same code, two artboards. */
  size: CodeInputSize;
}

/**
 * Everything below the two-factor title. Shared by both shells so the code rules cannot drift;
 * only the title treatment differs (an app bar on mobile, a row in the column on desktop).
 */
export function OtpFields({ otp, size }: OtpFieldsProps) {
  const { t } = useTranslation("adminAuth");
  const isExpired = otp.phase === "expired";
  const isInvalid = otp.phase === "invalidCode";

  return (
    <>
      <div className="pt-s2">
        <div className="text-body text-text-2">{t("otp.sentTo")}</div>
        <div className="font-mono text-body tabular-nums text-text-1">
          {otp.challenge?.maskedMobile}
        </div>
      </div>

      <div className="mt-s6">
        <CodeInput
          value={otp.code}
          onChange={otp.setCode}
          onComplete={() => void otp.form.handleSubmit()}
          length={OTP_LENGTH}
          label={t("otp.codeLabel")}
          size={size}
          invalid={isInvalid}
          dimmed={isExpired}
          disabled={isExpired || otp.form.isSubmitting}
          focusToken={otp.focusToken}
        />
      </div>

      {otp.errorMessage ? (
        <div role="alert" className="mt-s3 flex items-center justify-center gap-s2">
          <Icon glyph={isExpired ? Clock : CircleAlert} className="text-danger" />
          <span className="text-body text-danger">{otp.errorMessage}</span>
        </div>
      ) : null}

      {/* The code keeps ticking down while the admin retypes, so the expiry line survives a
          rejection — but not the expiry itself, where it would restate the error. */}
      {!isExpired ? (
        <div className="mt-s3 text-center text-label text-text-2">{otp.expiryLabel}</div>
      ) : null}

      {isExpired ? (
        <Button
          variant="primary"
          size="primary"
          block
          className="mt-s5 text-body"
          isLoading={otp.isResending}
          onClick={otp.resend}
        >
          {t("otp.resendNow")}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="primary"
          block
          className="mt-s5 text-body"
          isLoading={otp.form.isSubmitting}
          disabled={otp.code.length < OTP_LENGTH}
          onClick={() => void otp.form.handleSubmit()}
        >
          {otp.form.isSubmitting ? t("otp.verifying") : t("otp.verify")}
        </Button>
      )}

      <div className="mt-s4 text-center text-body">
        {isExpired ? (
          // A code cannot expire while the resend cooldown still runs, and resending is now the
          // primary action — a second, disabled resend beneath it would read as a dead end.
          <span className="text-text-3">{t("otp.resendNote")}</span>
        ) : (
          <>
            <span className="text-text-2">{t("otp.resendPrompt")} </span>
            {otp.canResend ? (
              <Button variant="textBrand" size="inline" onClick={otp.resend}>
                {otp.resendLabel}
              </Button>
            ) : (
              <span className="text-text-3">{otp.resendLabel}</span>
            )}
          </>
        )}
      </div>

      {/*
        Trust-this-device sits well clear of Verify: it is a consequential 30-day decision and must
        not be swept up in the same glance as the action the admin actually came here to take.
      */}
      <div className="mt-auto pt-s5 pb-s5">
        <Checkbox
          checked={otp.trustDevice}
          onCheckedChange={otp.setTrustDevice}
          label={t("otp.trustDevice")}
        />
      </div>
    </>
  );
}
