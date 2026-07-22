import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { EmptyState } from "../../components/ui/EmptyState";

/**
 * An empty alerts feed is good news, so it is drawn as relief rather than absence — green, not grey
 * (spec §4.10). This is the whole-screen version: nothing at all is waiting.
 */
export function AllCaughtUpEmpty() {
  const { t } = useTranslation("adminAlerts");

  return (
    <EmptyState
      icon={CheckCircle2}
      title={t("allCaughtUp")}
      body={t("allCaughtUpBody")}
      positive
      grow
    />
  );
}

/**
 * The partial version: nothing needs a decision, but the day still had events. A quiet strip, not a
 * celebration card — this is the state the console sits in most of the day, and anything louder
 * would be noise 200 times a week (desktop BOX 14).
 */
export function AllCaughtUpStrip() {
  const { t } = useTranslation("adminAlerts");

  return <Banner tone="success" icon={CheckCircle2} title={t("allCaughtUp")} />;
}
