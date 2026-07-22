import { Link } from "react-router";
import { Bell } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../components/ui/Icon";
import { ROUTES } from "../routes/routes.constants";
import { useShellCounters } from "../queries/useShellCounters";

export interface Crumb {
  readonly label: string;
  /** Omit on the trailing segment — the current page is not a link. */
  readonly to?: string;
}

export interface TopbarProps {
  /** The page name. Ignored when `crumbs` is given. */
  title?: string;
  crumbs?: readonly Crumb[];
  /** Page-level controls: a search field, a segmented range, a primary action. */
  actions?: React.ReactNode;
}

/** The 56px desktop topbar: where you are, what you can do here, and the alert bell. */
export function Topbar({ title, crumbs, actions }: TopbarProps) {
  const { t } = useTranslation("adminShell");
  const { criticalAlerts } = useShellCounters();

  return (
    <header className="topbar">
      {crumbs ? (
        <nav className="crumbs" aria-label={t("nav.sections")}>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span key={crumb.label} className="row-start">
                {index > 0 ? (
                  <span className="crumbs__sep" aria-hidden>
                    /
                  </span>
                ) : null}
                {crumb.to && !isLast ? (
                  <Link className="crumbs__link" to={crumb.to}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="crumbs__here" aria-current={isLast ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      ) : (
        <h1 className="topbar__title">{title}</h1>
      )}

      <div className="topbar__actions">
        {actions}
        <Link to={ROUTES.alerts} className="topbar__bell" aria-label={t("nav.alerts")}>
          <Icon glyph={Bell} size="lg" />
          {criticalAlerts > 0 ? (
            <span className="topbar__bell-badge">
              <span aria-hidden>{criticalAlerts}</span>
              <span className="sr-only">{t("nav.alerts")}</span>
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
