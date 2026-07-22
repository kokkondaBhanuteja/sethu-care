import { Clock } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../EmptyState";

/** Where the operator gets the same answer TODAY — a placeholder must not be a dead end. */
export interface ComingSoonInterimPath {
  /** One line naming the workaround, e.g. "Until then, find a customer through their booking." */
  readonly hint: string;
  readonly linkLabel: string;
  readonly to: string;
}

export interface ComingSoonStateProps {
  /** The section that is not built yet, so the notice names it. */
  section: string;
  /** The interim route to the same information (audit W2-8). */
  interim?: ComingSoonInterimPath;
}

/**
 * Section G of the approved designs — Customers, Tickets, Refunds, Analytics — is marked
 * "Fast-follow (v1.1): ships after A–F is approved". The routes and navigation entries exist now so
 * deep links and the sidebar are complete; the screens land next.
 */
export function ComingSoonState({ section, interim }: ComingSoonStateProps) {
  const { t } = useTranslation("adminShell");

  return (
    <EmptyState
      icon={Clock}
      title={`${section} — ${t("state.comingSoonTitle")}`}
      body={interim ? `${t("state.comingSoonBody")} ${interim.hint}` : t("state.comingSoonBody")}
      actions={
        interim ? (
          <Link
            to={interim.to}
            className="text-sm font-medium text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {interim.linkLabel}
          </Link>
        ) : undefined
      }
      grow
    />
  );
}
