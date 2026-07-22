# apps/admin/src/features/providers/mutations

Scope: TanStack Query write hooks for the providers feature.

Purpose: Every destructive decision in this feature passes through here, so the guard, the step-up gate and the undo window are applied once rather than per screen.

Contents:

- `useProviderActions.ts` — suspend / block / force offline (one payload, typed by action type) and restore. `ACTION_FOR_SUSPEND_TYPE` maps the chosen type onto its registry entry.
- `useApplicationDecisions.ts` — approve, reject, request documents.

Business logic:

- **The guard runs in the mutation path, not only on the button.** `useCan` is checked again inside `mutationFn` and a refusal throws a `403` `ApiError` — hiding a button is not the security model (`lib/permissions/can.ts`).
- Risk, step-up, reason-code and undo-window facts are read from `lib/permissions/actions.ts` through `useActionPolicy` / `useStepUp` / `useUndoableAction`. Nothing here restates that `block` is critical or that `suspend` gets 10 seconds of undo.
- Reject has no undo on purpose: the applicant is notified by SMS the moment it lands (spec §6.18).
- Success invalidates both the record and the list that shows it, so the roster stops offering a provider who was just suspended.

Dependencies: `@tanstack/react-query`, `../providers.api`, `../../../lib/permissions`, `../../../hooks`.

Boundaries: no rendering, no route knowledge (callers pass `onSuccess`), never import a `*.mock.ts`.

Impacted modules: the suspend flow, the provider profile, the application review.
