import { CircleAlert, Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { TextInput } from "../../components/ui/form/TextInput";
import { PASSWORD_RESET_URL } from "./auth.constants";
import type { UseLoginResult } from "./useLogin";

export interface LoginFormProps {
  login: UseLoginResult;
}

/**
 * Email + password. One component for both shells, because the fields, the copy and the rules are
 * identical — only the frame around them changes (design BOX 52 and BOX 83).
 *
 * There is no "Create account" affordance and there never will be: admin accounts are provisioned
 * by a Super Admin in the web dashboard (spec §10.1), and the closing note answers the question the
 * missing link raises.
 */
export function LoginForm({ login }: LoginFormProps) {
  const { t } = useTranslation("adminAuth");
  const { form, alert, isLockedOut, isOnline, isPasswordVisible, togglePasswordVisible } = login;

  // Locked and offline both make the form unusable; submitting only makes it briefly inert.
  const isBlocked = isLockedOut || !isOnline;
  const fieldsTone = isBlocked ? "opacity-40" : form.isSubmitting ? "opacity-60" : undefined;

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {alert ? (
        <Card
          role="alert"
          tone={alert.tone}
          density="tight"
          className="mb-s4 flex items-center gap-s2"
        >
          <Icon
            glyph={alert.tone === "warning" ? Lock : CircleAlert}
            className={alert.tone === "warning" ? "text-warning" : "text-danger"}
          />
          <span
            className={cx("text-body", alert.tone === "warning" ? "text-warning" : "text-danger")}
          >
            {alert.message}
          </span>
        </Card>
      ) : null}

      <div className="flex flex-col gap-s4">
        <div className={cx("flex flex-col gap-s4", fieldsTone)}>
          <TextInput
            label={t("login.emailLabel")}
            labelStyle="plain"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("login.emailPlaceholder")}
            disabled={isBlocked || form.isSubmitting}
            error={form.errorFor("email")}
            {...form.form.register("email")}
          />

          <TextInput
            label={t("login.passwordLabel")}
            labelStyle="plain"
            // Pasting is permitted — blocking it discourages password managers, which is worse.
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            disabled={isBlocked || form.isSubmitting}
            error={form.errorFor("password")}
            {...form.form.register("password")}
          />

          <div className="-mt-s2 flex justify-end">
            <Button
              variant="textBrand"
              size="inline"
              aria-pressed={isPasswordVisible}
              onClick={togglePasswordVisible}
              disabled={isBlocked || form.isSubmitting}
            >
              {isPasswordVisible ? t("login.hidePassword") : t("login.showPassword")}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="primary"
          block
          className="mt-s1 text-body"
          isLoading={form.isSubmitting}
          disabled={isBlocked}
        >
          {form.isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </div>

      <div className="mt-s5 text-center">
        {/* Reset never completes in the app — it opens the web dashboard (spec §5.2). */}
        <a
          className="text-body font-medium text-brand no-underline"
          href={PASSWORD_RESET_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t("login.forgotPassword")}
        </a>
      </div>
    </form>
  );
}
