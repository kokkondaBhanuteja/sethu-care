import { Fragment } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import {
  AvatarLabel,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@sethu/ui-web";

import { Avatar } from "../components/ui/Avatar";
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
  /** Set when the screen renders its own h1 (ui-web PageHeader) — the topbar then stays pure
      chrome, so every screen has exactly ONE heading. */
  pageRendersHeading?: boolean;
}

/**
 * The desktop topbar, restyled to the global language (P3): ui-web Breadcrumb over react-router
 * links, the alert bell, and the signed-in operator as an AvatarLabel identity block.
 */
export function Topbar({ title, crumbs, actions, pageRendersHeading }: TopbarProps) {
  const { t } = useTranslation("adminShell");
  const { criticalAlerts } = useShellCounters();
  const user = useSession((state) => state.user);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      {crumbs ? (
        <>
          {/* A crumbed page still needs exactly one h1: the trail is a <nav> of links, so the
              trailing crumb IS the page title — unless the screen mounts PageHeader, which then
              owns the single h1 (pageRendersHeading). */}
          {pageRendersHeading ? null : (
            <h1 className="sr-only">{crumbs[crumbs.length - 1]?.label}</h1>
          )}
          <Breadcrumb aria-label={t("nav.sections")}>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <Fragment key={crumb.label}>
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {crumb.to && !isLast ? (
                        <BreadcrumbLink as={Link} to={crumb.to}>
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage aria-current={isLast ? "page" : undefined}>
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      ) : (
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
      )}

      <div className="ml-auto flex items-center gap-3">
        {actions}
        <Link
          to={ROUTES.alerts}
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-inset hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("nav.alerts")}
        >
          <Icon glyph={Bell} size="lg" />
          {criticalAlerts > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fg px-1 text-pill font-semibold text-on-primary">
              <span aria-hidden>{criticalAlerts}</span>
              <span className="sr-only">{t("nav.alerts")}</span>
            </span>
          ) : null}
        </Link>
        {user ? (
          <AvatarLabel name={user.name} description={t("nav.roleOperations")}>
            <Avatar name={user.name} size="sm" brand />
          </AvatarLabel>
        ) : null}
      </div>
    </header>
  );
}
