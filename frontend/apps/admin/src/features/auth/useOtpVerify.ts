import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import { z } from "zod";

import { useAppForm, type AppForm } from "../../lib/forms/useAppForm";
import { ROUTES } from "../../routes/routes.constants";
import { resendOtp, revokeTrustedDevice, verifyOtp } from "./auth.api";
import { OTP_LENGTH } from "./auth.constants";
import { readAuthRouterState, resumePath } from "./authRouterState";
import { getDeviceId } from "./deviceIdentity";
import type { OtpChallenge, TrustedDevice } from "./auth.types";
import { useCountdown } from "./useCountdown";

interface OtpValues {
  code: string;
}

const OTP_SCHEMA = z.object({ code: z.string().length(OTP_LENGTH) });

export type OtpPhase = "entering" | "invalidCode" | "expired" | "deviceLimit";

export interface UseOtpVerifyResult {
  form: AppForm<OtpValues>;
  challenge: OtpChallenge | null;
  code: string;
  setCode: (next: string) => void;
  phase: OtpPhase;
  /** `That code isn't right. 2 attempts left.` / `This code expired.` — null while entering. */
  errorMessage: string | null;
  expiryLabel: string;
  resendLabel: string;
  canResend: boolean;
  resend: () => void;
  isResending: boolean;
  trustDevice: boolean;
  setTrustDevice: (trusted: boolean) => void;
  devices: readonly TrustedDevice[];
  revokeDevice: (deviceId: string) => void;
  revokingDeviceId: string | null;
  /** Bumped on every rejection so the code control returns focus to the first cell. */
  focusToken: number;
  goBack: () => void;
}

/**
 * The second factor, plus device registration (spec §6.3).
 *
 * This is the ADMIN LOGIN code. It shares no code path and no storage with the booking Start and
 * Completion OTPs an ops manager reads out at a job — confusing the two would mean an admin
 * reading their own login code to a provider.
 */
export function useOtpVerify(): UseOtpVerifyResult {
  const { t } = useTranslation("adminAuth");
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useSession((state) => state.signIn);

  const routerState = readAuthRouterState(location.state);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(routerState.challenge ?? null);
  const [phase, setPhase] = useState<OtpPhase>("entering");
  const [attemptsRemaining, setAttemptsRemaining] = useState(0);
  const [devices, setDevices] = useState<readonly TrustedDevice[]>([]);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [focusToken, setFocusToken] = useState(0);

  const expiry = useCountdown(challenge?.expiresInSeconds ?? 0);
  const cooldown = useCountdown(challenge?.resendInSeconds ?? 0);

  // A code cannot be verified without the challenge that issued it; a direct visit restarts login.
  useEffect(() => {
    if (!challenge) void navigate(ROUTES.login, { replace: true });
  }, [challenge, navigate]);

  const form = useAppForm<OtpValues>({
    schema: OTP_SCHEMA,
    defaultValues: { code: "" },
    onSubmit: async (values) => {
      if (!challenge) return;

      const outcome = await verifyOtp({
        challengeId: challenge.challengeId,
        code: values.code,
        trustDevice,
        deviceId: getDeviceId(),
      });

      if (outcome.status === "authenticated") {
        await signIn(outcome.session.token, outcome.session.user);
        void navigate(resumePath(routerState), { replace: true });
        return;
      }

      if (outcome.status === "deviceLimit") {
        setDevices(outcome.devices);
        setPhase("deviceLimit");
        return;
      }

      if (outcome.status === "attemptsExhausted") {
        // The token is dead server-side; there is nothing on this screen left to try (spec §6.3).
        void navigate(ROUTES.login, { replace: true, state: routerState });
        return;
      }

      // Cleared rather than left for editing: a half-corrected code is the most common way to burn
      // an attempt, and attempts are countable here (design BOX 56).
      form.form.setValue("code", "");
      setFocusToken((token) => token + 1);

      if (outcome.status === "expired") {
        setPhase("expired");
        return;
      }
      setAttemptsRemaining(outcome.attemptsRemaining);
      setPhase("invalidCode");
    },
  });

  const code = form.form.watch("code");

  const setCode = useCallback(
    (next: string) => {
      form.form.setValue("code", next, { shouldValidate: false });
      if (next.length > 0) setPhase("entering");
    },
    [form.form],
  );

  const resend = useCallback(() => {
    if (isResending || !challenge) return;
    setIsResending(true);
    void resendOtp(challenge.challengeId)
      .then((next) => {
        setChallenge(next);
        setPhase("entering");
        form.form.setValue("code", "");
        setFocusToken((token) => token + 1);
      })
      .finally(() => setIsResending(false));
  }, [challenge, form.form, isResending]);

  const revokeDevice = useCallback(
    (deviceId: string) => {
      setRevokingDeviceId(deviceId);
      void revokeTrustedDevice(deviceId)
        .then(() => {
          setDevices((current) => current.filter((device) => device.id !== deviceId));
          setPhase("entering");
          // A slot is free now, so the code the admin already typed can be retried immediately.
          void form.handleSubmit();
        })
        .finally(() => setRevokingDeviceId(null));
    },
    [form],
  );

  const goBack = useCallback(() => {
    void navigate(ROUTES.login, { replace: true, state: routerState });
  }, [navigate, routerState]);

  // The code dies on its own timer, so expiry is a state the screen enters without being told.
  const activePhase: OtpPhase =
    phase === "entering" && challenge !== null && expiry.hasElapsed ? "expired" : phase;

  return {
    form,
    challenge,
    code,
    setCode,
    phase: activePhase,
    errorMessage: describeError(),
    expiryLabel: t("otp.expiresIn", { countdown: expiry.label }),
    resendLabel: cooldown.hasElapsed
      ? t("otp.resendNow")
      : t("otp.resendIn", { countdown: cooldown.label }),
    canResend: cooldown.hasElapsed && !isResending,
    resend,
    isResending,
    trustDevice,
    setTrustDevice,
    devices,
    revokeDevice,
    revokingDeviceId,
    focusToken,
    goBack,
  };

  function describeError(): string | null {
    if (activePhase === "invalidCode") {
      return t("otp.wrongCode", { count: attemptsRemaining });
    }
    if (activePhase === "expired") return t("otp.expired");
    return null;
  }
}
