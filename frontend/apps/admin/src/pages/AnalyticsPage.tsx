import { useTranslation } from "@sethu/i18n";

import { ComingSoonState } from "../components/ui/states/ComingSoonState";
import { PageFrame } from "../layouts/PageFrame";
import { ROUTES } from "../routes/routes.constants";

/** Route target. Replaced by the feature implementation — see the feature folder's CLAUDE.md. */
export default function AnalyticsPage() {
  const { t } = useTranslation("adminShell");
  return (
    <PageFrame title={t("nav.analytics")}>
      <ComingSoonState
        section={t("nav.analytics")}
        interim={{
          hint: t("state.analyticsHint"),
          linkLabel: t("state.analyticsHintAction"),
          to: ROUTES.live,
        }}
      />
    </PageFrame>
  );
}
