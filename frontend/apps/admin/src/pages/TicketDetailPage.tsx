import { useTranslation } from "@sethu/i18n";

import { ComingSoonState } from "../components/ui/states/ComingSoonState";
import { PageFrame } from "../layouts/PageFrame";
import { ROUTES } from "../routes/routes.constants";

/** Route target. Replaced by the feature implementation — see the feature folder's CLAUDE.md. */
export default function TicketDetailPage() {
  const { t } = useTranslation("adminShell");
  return (
    <PageFrame title={t("nav.tickets")}>
      <ComingSoonState
        section={t("nav.tickets")}
        interim={{
          hint: t("state.ticketsHint"),
          linkLabel: t("state.ticketsHintAction"),
          to: ROUTES.alerts,
        }}
      />
    </PageFrame>
  );
}
