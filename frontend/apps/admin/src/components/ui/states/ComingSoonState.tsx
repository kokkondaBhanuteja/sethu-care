import { Clock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../EmptyState";

export interface ComingSoonStateProps {
  /** The section that is not built yet, so the notice names it. */
  section: string;
}

/**
 * Section G of the approved designs — Customers, Tickets, Refunds, Analytics — is marked
 * "Fast-follow (v1.1): ships after A–F is approved". The routes and navigation entries exist now so
 * deep links and the sidebar are complete; the screens land next.
 */
export function ComingSoonState({ section }: ComingSoonStateProps) {
  const { t } = useTranslation("adminShell");

  return (
    <EmptyState
      icon={Clock}
      title={`${section} — ${t("state.comingSoonTitle")}`}
      body={t("state.comingSoonBody")}
      grow
    />
  );
}
