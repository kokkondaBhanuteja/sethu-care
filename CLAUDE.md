# SETHU-CARE — root CLAUDE.md

One repo: **`backend/`** (Go modular monolith) + **`frontend/`** (pnpm/Turborepo — 3
Capacitor SPAs + Next.js landing + `@sethu/*` packages). Operational map: `AGENTS.md`.

## Task → the document that governs it (read it BEFORE working)

| Working on… | Governing docs |
|---|---|
| Backend Go code | `AGENTS.md` §3 + `.ai/*.md` rules + the package's `backend/internal/<pkg>/CLAUDE.md` |
| Backend architecture questions | `docs/architecture/BACKEND-ARCHITECTURE-REVIEW.md` |
| Frontend code (any app/package) | `frontend/ENGINEERING-STANDARDS.md` — **strict, every prompt** — + the folder's `CLAUDE.md` |
| Product flows / screen behaviour | `docs/Booking-Workflow-Decisions.md` + `docs/workflows/{customer,provider,admin}-workflow.md` (admin detail: `docs/Admin-Mobile-App.md`) |
| Committing / branching / PRs | `.claude/skills/git-conventions/SKILL.md` (Conventional Commits required) |
| Playwright E2E tests | `.claude/skills/playwright-e2e/SKILL.md` |

If several apply (e.g. a frontend feature that changes a workflow), apply all of them.

## Universals (every prompt, both halves)

- **No single-letter identifiers**, anywhere.
- **Never hand-edit generated code**: `backend/internal/storage/sqlcgen`,
  `backend/api/openapi.yaml`, `frontend/packages/api-client/src/generated` — regenerate
  (`make generate` / `make openapi` / `pnpm api:generate`).
- **Contract changes ripple in one PR**: handler → `make openapi` → client regen; schema →
  `make generate`; enum → Go constant + DB CHECK + drift test together.
- **Gates before "done"**: backend `make -C backend check`; frontend
  `turbo build/typecheck` + `lint` + `format:check` + `i18n:check`.
- **Commit/push only when asked**; branches off `developer`; pushes run from the user's
  shell (`! git push …`).
- Update the touched folder's `CLAUDE.md` in the same change.
