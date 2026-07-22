import { WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { AuthLayout } from "../../layouts/AuthLayout";
import { LoginForm } from "./LoginForm";
import { useLogin } from "./useLogin";

/**
 * The front door (design BOX 52 desktop, BOX 83 mobile).
 *
 * One screen for both shells: the fields, the copy and the rules are identical, and only the frame
 * changes — AuthLayout puts the 55% flat brand panel beside the column on desktop and stacks the
 * same content under the brand mark on a phone.
 */
export function LoginScreen() {
  const { t } = useTranslation("adminAuth");
  const login = useLogin();

  const offlineBanner = login.isOnline ? undefined : (
    // The banner explains the consequence, not just the fact: much of this console is cached, but
    // authentication never can be (design BOX 87).
    <Banner tone="warning" icon={WifiOff} title={t("login.offlineBanner")} />
  );

  return (
    <AuthLayout
      panel={{
        wordmark: t("brand.wordmark"),
        headline: t("brand.panelHeadline"),
        tagline: t("brand.panelTagline"),
      }}
      brand={{ wordmark: t("brand.wordmark"), subtitle: t("brand.console") }}
      {...(offlineBanner ? { banner: offlineBanner } : {})}
      footer={
        // Stands in for the sign-up link a consumer app would put here. It tells a locked-out admin
        // exactly who to go to instead of hunting for a button that was deliberately never built.
        <p className="mt-s8 text-center text-caption text-text-3">{t("login.provisioningNote")}</p>
      }
    >
      <LoginForm login={login} />
    </AuthLayout>
  );
}
