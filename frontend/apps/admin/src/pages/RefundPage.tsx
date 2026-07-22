import { useTranslation } from "@sethu/i18n";

import { ComingSoonState } from "../components/ui/states/ComingSoonState";

/** Route target. Replaced by the feature implementation — see the feature folder's CLAUDE.md. */
export default function RefundPage() {
  const { t } = useTranslation("adminShell");
  return <ComingSoonState section={t("nav.bookings")} />;
}
