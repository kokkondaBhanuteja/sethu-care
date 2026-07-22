import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import { z } from "zod";

import { useAppForm, type AppForm } from "../../lib/forms/useAppForm";
import { ROUTES } from "../../routes/routes.constants";
import { unlockWithPassword } from "./auth.api";
import { readAuthRouterState, resumePath } from "./authRouterState";

interface SessionLockValues {
  password: string;
}

const MIN_PASSWORD_LENGTH = 8;
const LOCK_SCHEMA = z.object({ password: z.string().min(MIN_PASSWORD_LENGTH) });

export interface UseSessionLockResult {
  form: AppForm<SessionLockValues>;
  accountLine: string;
  errorMessage: string | null;
  signOut: () => void;
}

/**
 * Desktop's answer to biometric unlock (design BOX 58). A browser has no fingerprint sensor, so the
 * step-up is the password the admin already typed to get here.
 *
 * Locking is not signing out: the session survives and the queue the admin was holding is still
 * theirs, so this never starts a fresh two-factor round.
 */
export function useSessionLock(): UseSessionLockResult {
  const { t } = useTranslation("adminAuth");
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession((state) => state.user);
  const endSession = useSession((state) => state.signOut);

  const [isRejected, setIsRejected] = useState(false);
  const historyState: unknown = location.state;

  const form = useAppForm<SessionLockValues>({
    schema: LOCK_SCHEMA,
    defaultValues: { password: "" },
    onSubmit: async (values) => {
      setIsRejected(false);
      const outcome = await unlockWithPassword(values.password);

      if (outcome.status === "unlocked") {
        void navigate(resumePath(readAuthRouterState(historyState)), { replace: true });
        return;
      }
      setIsRejected(true);
      form.form.setValue("password", "");
    },
  });

  const signOut = useCallback(() => {
    // The way past the lock without the password — available, but it discards the held queue.
    void endSession().then(() => navigate(ROUTES.login, { replace: true }));
  }, [endSession, navigate]);

  return {
    form,
    accountLine: [user?.name, user?.email].filter(Boolean).join(" · "),
    errorMessage: isRejected ? t("lock.wrongPassword") : null,
    signOut,
  };
}
