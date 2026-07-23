import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import { z } from "zod";

import { API_ERROR_CODES, type ApiError } from "../../lib/http/apiError";
import { useAppForm, type AppForm } from "../../lib/forms/useAppForm";
import { ROUTES } from "../../routes/routes.constants";
import { login } from "./auth.api";
import { getDeviceId, getDeviceName } from "./deviceIdentity";
import { readAuthRouterState, resumePath } from "./authRouterState";
import { useCountdown } from "./useCountdown";
import { useIsOnline } from "./useIsOnline";

const MIN_PASSWORD_LENGTH = 8;

export interface LoginValues {
  email: string;
  password: string;
}

/** The strip above the form. Amber is a timed cool-off; red is a refusal (design BOX 53 / 54). */
export interface LoginAlert {
  readonly tone: "danger" | "warning";
  readonly message: string;
  /** Both fields carry the error border, because the message never says which one was wrong. */
  readonly marksFields: boolean;
}

export interface UseLoginResult {
  form: AppForm<LoginValues>;
  alert: LoginAlert | null;
  /** True while a server-side lockout is running: the form is inert but Forgot password is not. */
  isLockedOut: boolean;
  isOnline: boolean;
  isPasswordVisible: boolean;
  togglePasswordVisible: () => void;
}

/**
 * The first factor. Shared by the desktop and mobile login screens so the two cannot drift
 * (spec §2.1) — only their layout differs, never their rules.
 *
 * Nothing here is a security control: attempt counting, lockout and rate limiting are enforced by
 * the server (spec §5.8). This renders the answers the server gives.
 */
export function useLogin(): UseLoginResult {
  const { t } = useTranslation("adminAuth");
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useSession((state) => state.signIn);
  const isOnline = useIsOnline();

  const [rejection, setRejection] = useState<"invalidCredentials" | "disabled" | "locked" | null>(
    null,
  );
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const lockout = useCountdown(lockoutSeconds);

  const routerState = readAuthRouterState(location.state);

  const schema = useMemo(
    () =>
      z.object({
        // Trimmed and lowercased before it leaves the form, so "Ravi@ " and "ravi@" are one account.
        email: z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email(t("login.emailInvalid"))),
        password: z.string().min(MIN_PASSWORD_LENGTH, t("login.passwordRequired")),
      }),
    [t],
  );

  const form = useAppForm<LoginValues>({
    schema,
    defaultValues: { email: "", password: "" },
    onSubmit: async (values) => {
      setRejection(null);

      const outcome = await login({
        email: values.email,
        password: values.password,
        deviceId: await getDeviceId(),
        deviceName: getDeviceName(),
      });

      if (outcome.status === "invalidCredentials" || outcome.status === "disabled") {
        setRejection(outcome.status);
        return;
      }

      if (outcome.status === "locked") {
        setRejection("locked");
        setLockoutSeconds(outcome.retryAfterSeconds);
        return;
      }

      if (outcome.status === "authenticated") {
        // A device the server already trusts skips the second factor (spec §5.2).
        await signIn(outcome.session.token, outcome.session.user);
        void navigate(resumePath(routerState), { replace: true });
        return;
      }

      void navigate(ROUTES.loginOtp, {
        replace: true,
        state: { ...routerState, challenge: outcome.challenge },
      });
    },
  });

  const togglePasswordVisible = useCallback(() => {
    setIsPasswordVisible((visible) => !visible);
  }, []);

  const isLockedOut = rejection === "locked" && !lockout.hasElapsed;

  return {
    form,
    alert: buildAlert(),
    isLockedOut,
    isOnline,
    isPasswordVisible,
    togglePasswordVisible,
  };

  function buildAlert(): LoginAlert | null {
    if (isLockedOut) {
      // Amber, not red: the account is fine, it is only waiting. Red reads as "your account is gone".
      return {
        tone: "warning",
        message: t("login.locked", { countdown: lockout.label }),
        marksFields: false,
      };
    }
    if (rejection === "invalidCredentials") {
      return { tone: "danger", message: t("login.invalidCredentials"), marksFields: true };
    }
    if (rejection === "disabled") {
      return { tone: "danger", message: t("login.disabled"), marksFields: false };
    }
    if (form.formError) {
      return { tone: "danger", message: transportMessage(form.formError), marksFields: false };
    }
    return null;
  }

  function transportMessage(error: ApiError): string {
    if (error.code === API_ERROR_CODES.network || error.code === API_ERROR_CODES.timeout) {
      return t("login.network");
    }
    // The code is in the copy because it is what support asks for first.
    return t("login.server", { code: error.status ? `E-${error.status}` : error.code });
  }
}
