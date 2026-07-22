# apps/admin/src/lib

Scope: App-wide non-React glue. No components, no JSX.

Purpose: The cross-cutting machinery every feature depends on — environment, error normalisation, query client, permissions, formatting, forms, toasts.

Contents:

- `env.ts` — the ONLY reader of `import.meta.env`.
- `cx.ts` — class-name join.
- `http/apiError.ts` — normalises every thrown value into one `ApiError { code, message, status, retryable, fieldErrors? }`.
- `query/queryClient.ts` — retry policy, stale time, mutation-error → toast bridge. Mutations never retry: this console cancels bookings and issues refunds.
- `permissions/` — `actions.ts` is the action registry from Admin spec §10.2/§10.3 (risk, step-up, reason, undo window); `can.ts` is the gate; `usePermission.ts` is the React binding.
- `format/` — en-IN money, date, time, relative, duration, phone, percent (spec §4.7). IST, never user-configurable.
- `forms/useAppForm.ts` — the one form wrapper: typed values, zod schema, field errors, submit-in-flight, duplicate-submission guard, API-error → field mapping.
- `toast/toastStore.ts` — transient UI state, including the undo windows from the risk register.

Business logic: permission decisions, error classification, retry policy, undo windows.

Dependencies: `@sethu/{core,domain,i18n}`, `@tanstack/react-query`, zustand, react-hook-form, zod.

Boundaries: nothing here imports a feature. Screens never read `import.meta.env`, never build an error shape by hand, and never restate a step-up or undo policy — they read the registry.

Impacted modules: every feature.
