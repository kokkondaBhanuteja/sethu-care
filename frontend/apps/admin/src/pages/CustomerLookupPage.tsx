import { useTranslation } from "@sethu/i18n";

import { ComingSoonState } from "../components/ui/states/ComingSoonState";
import { PageFrame } from "../layouts/PageFrame";
import { ROUTES } from "../routes/routes.constants";

/** Route target. Replaced by the feature implementation — see the feature folder's CLAUDE.md. */
export default function CustomerLookupPage() {
  const { t } = useTranslation("adminShell");
  return (
    <PageFrame title={t("nav.customers")}>
      <ComingSoonState
        section={t("nav.customers")}
        interim={{
          hint: t("state.customersHint"),
          linkLabel: t("state.customersHintAction"),
          to: ROUTES.bookings,
        }}
      />
    </PageFrame>
  );
}
