# apps/admin/src/layouts

Scope: The two page shells and the navigation chrome. Never business logic.

Purpose: Spec §2.1's responsive single-app model — one codebase, two deliberate frames — restyled in P3 to the global premium-ERP language (gray `bg-canvas` page, white surfaces, soft active pills).

Contents:

- `AdminShell.tsx` — picks one shell by viewport; only one is mounted at a time.
- `DesktopShell.tsx` + `Sidebar.tsx` + `SidebarNavItem.tsx` + `Topbar.tsx` — the desktop frame. `Sidebar` is COMPOSED on the `@sethu/ui-web` Sidebar suite (SidebarProvider/Sidebar/Group/Menu/MenuButton with `as={NavLink}`); the provider lives inside `Sidebar.tsx` so the rail is self-contained, and the header carries a visible `SidebarTrigger` beside the Cmd/Ctrl+B shortcut. `SidebarNavItem` renders one rail row: a StatusPill count badge for live counters, the neutral "v1.1" pill for `comingSoon` items (never a count — audit W2-4), and the collapsed rail shows the ui-web badge dot (brand-tinted via `badgeDotClassName` where `badgeTone: "brand"`). `Topbar` composes ui-web Breadcrumb (react-router `Link` via `as`) + an AvatarLabel identity block — the former alert bell was REMOVED (it duplicated the sidebar Alerts badge and opened no menu, audit W2-6).
- `MobileShell.tsx` + `TabBar.tsx` + `MobileAppBar.tsx` — five tabs, sticky app bar, `.screen__scroll` as the scroll container. Mobile keeps the TabBar design (the ui-web sidebar's mobile sheet is deliberately not used here). `TabBar` derives its active tab from `tabForPath()` (the route table's tab column), never from path-prefix matching — /customers and /settings/* light up More (audit W2-3).
- `PageFrame.tsx` — the standard page frame for screens with no bespoke chrome (today the v1.1 placeholder pages): Topbar + PageMain on desktop, MobileAppBar (title + back) + tab-bar-aware MobileScroll on mobile.
- `ToastHost` mounts INSIDE `.app__main` on desktop so the toast anchors to the content area and never covers the sidebar (audit W2-5).
- `PageMain.tsx` — the desktop scroll region (`.main`, edge-to-edge); non-flush content renders inside ui-web `PageShell`, which owns the page padding, the centred max-width column and the 24px between-section rhythm. `MobileScroll` unchanged.
- `Layout.tsx` — Split/Stack/Gutter/TileGrid/SectionGap. `Stack`'s section gap is 24px, matching PageShell.
- `ActionBar/AuthLayout` — still on the legacy component layer. (`SettingsLayout` is gone: the
  settings family's desktop frame is now `features/settings/SettingsShell`, composed on
  PageMain + ui-web PageHeader.)
- `navigation.constants.ts` — sidebar groups and mobile tabs, with their badge sources. `comingSoon: true` marks v1.1 destinations (Customers, Tickets, Analytics): they never carry a live counter. The finance/config group is titled "Finance & config" and is NOT muted — on the rail (desktop-only by definition) every item in it works (audit W2-7).

Business logic: badge discipline only — the Alerts badge counts unacknowledged CRITICAL alerts alone (spec §3.1).

Dependencies: `@sethu/ui-web`, `../routes/routes.constants`, `../queries/useShellCounters`, `../components/ui`, `@sethu/{core,i18n}`.

Boundaries: `MobileShell` and `DesktopShell` stay SEPARATE components. Pages own their own `Topbar`/`MobileAppBar`. Safe areas are handled here and in `index.css`, never per screen. `sidebar__group-header` and `is-active` in `Sidebar.tsx` are UNSTYLED marker classes — stable hooks for tests, not styling.

Impacted modules: every screen renders inside one of these.
