# apps/admin/src/layouts

Scope: The two page shells and the navigation chrome. Never business logic.

Purpose: Spec §2.1's responsive single-app model — one codebase, two deliberate frames.

Contents:

- `AdminShell.tsx` — picks one shell by viewport; only one is mounted at a time.
- `DesktopShell.tsx` + `Sidebar.tsx` + `Topbar.tsx` — 240px sidebar (three groups), 56px topbar, scrolling `.main`. Desktop has no tab bar.
- `MobileShell.tsx` + `TabBar.tsx` + `MobileAppBar.tsx` — five tabs, sticky app bar, `.screen__scroll` as the scroll container.
- `navigation.constants.ts` — sidebar groups and mobile tabs, with their badge sources.

Business logic: badge discipline only — the Alerts badge counts unacknowledged CRITICAL alerts alone, because a permanently non-zero badge is invisible (spec §3.1).

Dependencies: `../routes/routes.constants`, `../queries/useShellCounters`, `../components/ui`, `@sethu/{core,i18n}`.

Boundaries: `MobileShell` and `DesktopShell` stay SEPARATE components — mobile is never media-query-squeezed desktop. Pages own their own `Topbar`/`MobileAppBar`, because breadcrumbs, page actions and alert bands are page-specific and hoisting them would prop-drill every one through the shell. Safe areas are handled here and in `index.css`, never per screen.

Impacted modules: every screen renders inside one of these.
