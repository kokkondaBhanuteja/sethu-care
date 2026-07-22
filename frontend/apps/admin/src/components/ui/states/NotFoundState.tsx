import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { buttonVariants, cn } from "@sethu/ui-web";

import { DEFAULT_ROUTE } from "../../../routes/routes.constants";
import { EmptyState } from "../EmptyState";

export interface NotFoundStateProps {
  /** What vanished — "This booking", "This provider". Keeps the sentence specific. */
  subject?: string;
  grow?: boolean;
}

/**
 * A record that no longer exists. A deep link to a deleted booking must land here, never on a crash
 * or a blank screen, and must always offer a route back (spec §3.4 rule 3).
 */
export function NotFoundState({ subject, grow = true }: NotFoundStateProps) {
  const { t } = useTranslation("adminShell");

  return (
    <EmptyState
      icon={SearchX}
      // The subject IS the sentence's subject, so it replaces the generic noun rather than
      // prefixing it — "This provider this record no longer exists" was the old result.
      title={subject ? t("state.notFoundSubject", { subject }) : t("state.notFoundTitle")}
      body={t("state.notFoundBody")}
      grow={grow}
      actions={
        // P3: a Link styled through the ui-web button variant map — same look as Button.
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full")}
          to={DEFAULT_ROUTE}
        >
          {t("state.notFoundAction")}
        </Link>
      }
    />
  );
}
