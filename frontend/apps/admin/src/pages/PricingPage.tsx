import { useTranslation } from "@sethu/i18n";

import { ComingSoonState } from "../components/ui/states/ComingSoonState";
import { Topbar } from "../layouts/Topbar";

/**
 * A configuration surface that is desktop-only by product rule (spec §1.5) and not built yet. It
 * keeps its route and its sidebar entry so deep links and navigation stay complete, and says
 * plainly that the screen has not landed rather than rendering an empty frame.
 */
export default function PricingPage() {
  const { t } = useTranslation("adminShell");
  const section = t("nav.pricing");

  return (
    <>
      <Topbar title={section} />
      <main className="main">
        <ComingSoonState section={section} />
      </main>
    </>
  );
}
