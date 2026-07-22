import { Fragment, Suspense, lazy, useState } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@sethu/ui-web";

import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { APP_BUILD } from "../lib/env";
import { useShellCounters } from "../queries/useShellCounters";
import { SIDEBAR_GROUPS } from "./navigation.constants";
import { SidebarNavItem } from "./SidebarNavItem";

// Lazy on purpose: the shell is on the critical path and this dialog is not. Importing it eagerly
// pulled the whole settings feature — its api, mocks and fixtures — into the entry chunk.
const SignOutConfirm = lazy(() =>
  import("../features/settings/SignOutConfirm").then((module) => ({
    default: module.SignOutConfirm,
  })),
);

/**
 * The persistent rail, composed on the @sethu/ui-web Sidebar suite (P3): nav groups come from
 * navigation.constants + i18n, counts are StatusPill badges, the signed-in operator sits in the
 * footer. The provider lives here (not the shell) so the rail is self-contained for tests; its
 * Cmd/Ctrl+B shortcut gives desktop the icon-collapse. Desktop has no tab bar and no More menu,
 * so all eighteen destinations live here.
 */
export function Sidebar() {
  const { t } = useTranslation("adminShell");
  const counters = useShellCounters();
  const user = useSession((state) => state.user);
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <SidebarProvider>
      <UiSidebar label={t("nav.primary")}>
        <SidebarHeader className="group-data-[collapsed]/sidebar:flex-col group-data-[collapsed]/sidebar:px-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon glyph={Zap} size="sm" />
          </span>
          <span className="truncate text-base font-bold leading-none tracking-tight text-ink group-data-[collapsed]/sidebar:sr-only">
            {t("brand")}
          </span>
          {/* The visible collapse affordance (audit W2-2): Cmd/Ctrl+B still works, but a
              shortcut nobody can discover is not an affordance. Present in both states. */}
          <SidebarTrigger
            label={t("nav.toggleSidebar")}
            className="ml-auto group-data-[collapsed]/sidebar:ml-0"
          />
        </SidebarHeader>

        <SidebarContent>
          {SIDEBAR_GROUPS.map((group) => (
            <Fragment key={group.titleKey}>
              {group.dividerBefore ? <SidebarSeparator /> : null}
              <SidebarGroup>
                {/* sidebar__group-header is the stable structural hook (tests) — unstyled. */}
                <SidebarGroupLabel className="sidebar__group-header">
                  {t(group.titleKey)}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarNavItem key={item.to} item={item} counters={counters} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </Fragment>
          ))}
        </SidebarContent>

        {user ? (
          <SidebarFooter>
            {/* The design pins Sign out behind this row, because desktop has no More tab. */}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsSigningOut(true)}
            >
              <Avatar name={user.name} size="sm" brand />
              <span className="flex min-w-0 grow flex-col group-data-[collapsed]/sidebar:sr-only">
                <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
                <span className="truncate text-xs text-faint">{t("nav.roleOperations")}</span>
              </span>
              <span className="flex text-faint group-data-[collapsed]/sidebar:sr-only">
                <Icon glyph={ChevronDown} size="sm" label={t("nav.openMenu")} />
              </span>
            </button>
            {isSigningOut ? (
              <Suspense fallback={null}>
                <SignOutConfirm isOpen onDismiss={() => setIsSigningOut(false)} />
              </Suspense>
            ) : null}
          </SidebarFooter>
        ) : null}

        <div className="px-2 pb-1 pt-2 text-xs text-faint group-data-[collapsed]/sidebar:sr-only">
          {APP_BUILD.label}
        </div>
      </UiSidebar>
    </SidebarProvider>
  );
}
