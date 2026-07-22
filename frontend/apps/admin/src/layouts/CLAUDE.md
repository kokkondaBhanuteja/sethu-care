# apps/admin/src/layouts

Scope: The two page shells and the navigation chrome. Never business logic.

Purpose: Spec §2.1's responsive single-app model — one codebase, two deliberate frames — restyled in P3 to the global premium-ERP language (gray `bg-canvas` page, white surfaces, soft active pills).

Contents:

- `AdminShell.tsx` — picks one shell by viewport; only one is mounted at a time.
- `DesktopShell.tsx` + `Sidebar.tsx` + `Topbar.tsx` — the desktop frame. `Sidebar` is COMPOSED on the `@sethu/ui-web` Sidebar suite (SidebarProvider/Sidebar/Group/Menu/MenuButton with `as={NavLink}`, StatusPill count badges); the provider lives inside `Sidebar.tsx` so the rail is self-contained (Cmd/Ctrl+B collapses it to the icon rail; there is no visible SidebarTrigger yet). `Topbar` composes ui-web Breadcrumb (react-router `Link` via `as`) + the alert bell + an AvatarLabel identity block.
- `MobileShell.tsx` + `TabBar.tsx` + `MobileAppBar.tsx` — five tabs, sticky app bar, `.screen__scroll` as the scroll container. Mobile keeps the TabBar design (the ui-web sidebar's mobile sheet is deliberately not used here).
- `PageMain.tsx` — the desktop scroll region (`.main`, edge-to-edge); non-flush content renders inside ui-web `PageShell`, which owns the page padding, the centred max-width column and the 24px between-section rhythm. `MobileScroll` unchanged.
- `Layout.tsx` — Split/Stack/Gutter/TileGrid/SectionGap. `Stack`'s section gap is 24px, matching PageShell.
- `ActionBar/AuthLayout` — still on the legacy component layer. (`SettingsLayout` is gone: the
  settings family's desktop frame is now `features/settings/SettingsShell`, composed on
  PageMain + ui-web PageHeader.)
- `navigation.constants.ts` — sidebar groups and mobile tabs, with their badge sources.

Business logic: badge discipline only — the Alerts badge counts unacknowledged CRITICAL alerts alone (spec §3.1).

Dependencies: `@sethu/ui-web`, `../routes/routes.constants`, `../queries/useShellCounters`, `../components/ui`, `@sethu/{core,i18n}`.

Boundaries: `MobileShell` and `DesktopShell` stay SEPARATE components. Pages own their own `Topbar`/`MobileAppBar`. Safe areas are handled here and in `index.css`, never per screen. `sidebar__group-header` and `is-active` in `Sidebar.tsx` are UNSTYLED marker classes — stable hooks for tests, not styling.

Impacted modules: every screen renders inside one of these.
