# apps/admin/src/features/providers/mutations

Scope: TanStack Query write hooks for the providers feature.

Purpose: Every destructive decision in this feature passes through here, so the guard, the step-up gate and the undo window are applied once rather than per screen.

Contents:

- `useProviderActions.ts` — suspend / block / force offline (one payload, typed by action type) and restore. `ACTION_FOR_SUSPEND_TYPE` maps the chosen type onto its registry entry. Restore now carries the CAS `version` (callers pass the profile's); the suspension's undo restores with the post-write version from the result.
- `useApplicationDecisions.ts` — approve, reject, request documents. Takes the loaded review so every decision sends its CAS `version`; request-documents derives what is owed via `outstandingDocumentKeys` (providers.api.requests.ts). `reject` rethrows the ApiError so `useApplicationReview` can land a 422 field error on the note.

Business logic:

- **The guard runs in the mutation path, not only on the button.** `useCan` is checked again inside `mutationFn` and a refusal throws a `403` `ApiError` — hiding a button is not the security model (`lib/permissions/can.ts`).
- Risk, step-up, reason-code and undo-window facts are read from `lib/permissions/actions.ts` through `useActionPolicy` / `useStepUp` / `useUndoableAction`. Nothing here restates that `block` is critical or that `suspend` gets 10 seconds of undo.
- Reject has no undo on purpose: the applicant is notified by SMS the moment it lands (spec §6.18).
- Success invalidates both the record and the list that shows it, so the roster stops offering a provider who was just suspended.
- **A conflict re-reads the record.** 409 VERSION_CONFLICT / ALREADY_DECIDED (and the approve 422, whose blockers the server recomputed) invalidate the record so the designed banner or blocker renders from the refetch — the structured extras have no slot on `ApiError`, and the server stays authoritative.
- Failures are announced once, by the mutation-cache toast bridge; the suspend submit swallows the rethrow after it so no rejection escapes to the console.

Dependencies: `@tanstack/react-query`, `../providers.api`, `../../../lib/permissions`, `../../../hooks`.

Boundaries: no rendering, no route knowledge (callers pass `onSuccess`), never import a `*.mock.ts`.

Impacted modules: the suspend flow, the provider profile, the application review.
