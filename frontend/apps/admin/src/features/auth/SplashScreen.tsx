import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { AuthLayout, AUTH_FRAMES } from "../../layouts/AuthLayout";
import { BUILD_STAMP } from "./auth.constants";
import { ForcedUpdateScreen } from "./ForcedUpdateScreen";
import { useSplashBoot } from "./useSplashBoot";

/**
 * The hand-off screen (design BOX 51 desktop, BOX 79–81 mobile).
 *
 * The logo is not scaled up for the 1440px canvas — the same mark and wordmark as mobile, sitting
 * in six times the empty space. Enlarging it would turn a half-second hand-off into a brand
 * statement, which is the one thing a splash screen must not be.
 */
export function SplashScreen() {
  const { t } = useTranslation("adminAuth");
  const boot = useSplashBoot();

  if (boot.phase === "updateRequired") return <ForcedUpdateScreen />;

  const buildStamp = (
    <span className="text-caption text-text-3">
      {t("brand.build", { version: BUILD_STAMP.version, environment: BUILD_STAMP.environment })}
    </span>
  );

  if (boot.phase === "error") {
    return (
      <AuthLayout
        frame={AUTH_FRAMES.centred}
        brand={{ wordmark: t("brand.wordmark") }}
        footer={buildStamp}
      >
        {/* The composition does not move: the mark and wordmark stay put and only the message
            below them changes, which is what stops a failure from feeling like a different app. */}
        <div role="alert" className="mt-s5 text-center text-card text-text-1">
          {t("splash.errorTitle")}
        </div>
        <div className="mt-s1 text-center text-label text-text-2">{t("splash.errorBody")}</div>

        <div className="mt-s6 flex w-60 flex-col gap-s2">
          <Button variant="primary" size="secondary" block onClick={boot.retry}>
            {t("splash.retry")}
          </Button>
          <Button variant="text" size="secondary" block onClick={boot.signOut}>
            {t("splash.signOut")}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      frame={AUTH_FRAMES.centred}
      brand={{ wordmark: t("brand.wordmark"), subtitle: t("brand.console") }}
      footer={buildStamp}
    >
      {/* No spinner and no progress bar: "Connecting…" says what a spinner would say, without
          implying progress the app cannot measure. It waits 3s so it never flashes. */}
      {boot.phase === "slow" ? (
        <div role="status" className="mt-s4 text-label text-text-2">
          {t("splash.connecting")}
        </div>
      ) : null}
    </AuthLayout>
  );
}
