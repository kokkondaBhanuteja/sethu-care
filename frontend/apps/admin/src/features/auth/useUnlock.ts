import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";

import { ROUTES } from "../../routes/routes.constants";
import { unlockWithPasscode } from "./auth.api";
import { PASSCODE_ATTEMPTS_BEFORE_RELOGIN, PASSCODE_LENGTH } from "./auth.constants";
import { readAuthRouterState, resumePath } from "./authRouterState";
import { BIOMETRIC_RESULTS, requestBiometricUnlock } from "./biometric";

/** BOX 92 offers the sensor; BOX 93 is the refusal; BOX 94 swaps the glyph for passcode cells. */
export type UnlockPhase = "prompt" | "refused" | "passcode";

export interface UseUnlockResult {
  phase: UnlockPhase;
  /** Named account: an admin returning to a shared ops room needs to know whose session this is. */
  accountLine: string;
  /** The refusal or the "no enrolment" line under the title. Null on the untouched prompt. */
  message: string | null;
  retryBiometric: () => void;
  showPasscode: () => void;
  passcode: string;
  setPasscode: (next: string) => void;
  submitPasscode: () => void;
  isCheckingPasscode: boolean;
  passcodeError: string | null;
  /** Bumped after a wrong passcode so entry resumes at the first cell. */
  focusToken: number;
  signOut: () => void;
}

/**
 * Re-verify identity on resume without a full login (spec §5.4, design BOX 92–94).
 *
 * Biometric fires on mount, every resume, regardless of how long the app was backgrounded — a
 * three-second background trip is not a security exception, and inconsistency trains admins to
 * treat the lock as optional.
 */
export function useUnlock(): UseUnlockResult {
  const { t } = useTranslation("adminAuth");
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession((state) => state.user);
  const endSession = useSession((state) => state.signOut);

  const [phase, setPhase] = useState<UnlockPhase>("prompt");
  const [message, setMessage] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [isCheckingPasscode, setIsCheckingPasscode] = useState(false);
  const [failedPasscodes, setFailedPasscodes] = useState(0);
  const [focusToken, setFocusToken] = useState(0);

  const historyState: unknown = location.state;

  const resume = useCallback(() => {
    void navigate(resumePath(readAuthRouterState(historyState)), { replace: true });
  }, [historyState, navigate]);

  const signOut = useCallback(() => {
    void endSession().then(() => navigate(ROUTES.login, { replace: true }));
  }, [endSession, navigate]);

  const attemptBiometric = useCallback(() => {
    void requestBiometricUnlock().then((result) => {
      if (result === BIOMETRIC_RESULTS.success) {
        resume();
        return;
      }
      if (result === BIOMETRIC_RESULTS.cancelled) return;

      setPhase("refused");
      setMessage(
        result === BIOMETRIC_RESULTS.unavailable
          ? t("unlock.unavailable")
          : t("unlock.notRecognised"),
      );
    });
  }, [resume, t]);

  useEffect(attemptBiometric, [attemptBiometric]);

  const showPasscode = useCallback(() => {
    setPhase("passcode");
    setMessage(null);
  }, []);

  const submitPasscode = useCallback(() => {
    if (isCheckingPasscode || passcode.length < PASSCODE_LENGTH) return;
    setIsCheckingPasscode(true);

    void unlockWithPasscode(passcode)
      .then((isCorrect) => {
        if (isCorrect) {
          resume();
          return;
        }
        const failures = failedPasscodes + 1;
        setFailedPasscodes(failures);
        setPasscode("");
        setFocusToken((token) => token + 1);
        // Three failures clears the session: a changed enrolment may mean a new person's finger.
        if (failures >= PASSCODE_ATTEMPTS_BEFORE_RELOGIN) signOut();
      })
      .finally(() => setIsCheckingPasscode(false));
  }, [failedPasscodes, isCheckingPasscode, passcode, resume, signOut]);

  const triesLeft = PASSCODE_ATTEMPTS_BEFORE_RELOGIN - failedPasscodes;

  return {
    phase,
    accountLine: [user?.name, user?.email].filter(Boolean).join(" · "),
    message,
    retryBiometric: attemptBiometric,
    showPasscode,
    passcode,
    setPasscode,
    submitPasscode,
    isCheckingPasscode,
    passcodeError:
      failedPasscodes > 0 && triesLeft > 0 ? t("unlock.wrongPasscode", { count: triesLeft }) : null,
    focusToken,
    signOut,
  };
}
