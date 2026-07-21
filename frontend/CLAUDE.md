# frontend/ — CLAUDE.md

Scope: the pnpm + Turborepo frontend workspace — 3 Capacitor SPAs (customer, provider,
admin: Vite + React 19 + React Router 7 + TanStack Query + zustand + Tailwind 4) +
the Next.js landing page + the shared `@sethu/*` packages.

**Every change in this tree follows [`ENGINEERING-STANDARDS.md`](./ENGINEERING-STANDARDS.md) — strictly, on every prompt.** Read it before writing code. The rules a change most often trips over:

1. **Reuse before creating** — search the feature → the app → `packages/` first.
2. **Folder structure + promote-upward** — feature-scoped `.tsx`/`.api.ts`/`.types.ts`/
   `.constants.ts`; shared by 2+ features → app layer; shared by 2+ apps → `@sethu/*`.
   Apps never import apps; features never import sibling features.
3. **A `CLAUDE.md` in every folder**, updated in the same change as the code.
4. **Strict types** — no `any`, no leaked `unknown`; server shapes from
   `@sethu/api-client` (GENERATED — never hand-edit; `pnpm api:generate`); backend
   vocabularies from `@sethu/domain`, never raw string literals.
5. **No hardcoded values** — Tailwind token utilities only (no `[#hex]`/`[Npx]`
   arbitrary values); routes/keys/numbers in `*.constants.ts`.
6. **All user-facing text via `@sethu/i18n`** — keys in en + hi + te in the same change
   (`pnpm i18n:check` gates CI).
7. **Four data states** (loading/error/empty/data) on every data screen; server state in
   TanStack Query only; session via `@sethu/core` storage adapter.
8. `.tsx` ≤ 150 lines, single responsibility; no single-letter identifiers.
9. Capacitor `ios/`/`android/` are committed source — after web changes run
   `pnpm cap:sync`; safe areas handled once in the shell.

Verify before committing: `pnpm turbo build && pnpm turbo typecheck && pnpm lint &&
pnpm format:check && pnpm i18n:check`.
