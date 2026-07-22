# apps/admin/src/hooks

Scope: App-wide React hooks. Feature-specific hooks live with their feature.

Purpose: Behaviour several features need, implemented once.

Contents:

- `useBreakpoint.ts` — `useIsDesktop()`, the 768px shell split. Carries a dev-only `?shell=mobile|desktop` override so the mobile frame can be reviewed on a desktop browser.
- `useFocusTrap.ts` — focus trap, Escape-to-dismiss and focus restore for modals, drawers and sheets.
- `useStepUp.ts` — the 60-second step-up window; whether an action needs it is read from the action registry.
- `useUndoableAction.ts` — raises the confirmation toast with the undo window the risk register gives that action (10s / 30s / none).
- `useDebouncedValue.ts` — search debounce.

Business logic: step-up freshness and undo windows come from `lib/permissions/actions.ts`. These hooks apply the policy; they do not define it.

Dependencies: react, `@sethu/i18n`, `../lib`.

Boundaries: no data fetching (that is `queries/`), no feature imports.

Impacted modules: every destructive flow, every overlay, every search field.
