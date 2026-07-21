---
name: git-conventions
description: Conventional Commits, branch naming, and PR conventions for SETHU-CARE. Use when committing code, creating branches, or writing PR descriptions.
---

# Git Conventions — SETHU-CARE

**Enforced automatically:** locally by the `.husky/commit-msg` hook, and in CI by the
required `git` check (`.github/workflows/git.yml`) — branch name and every PR commit
subject are validated (PR titles are convention, not CI-enforced). What follows is the standard those checks implement.

## Conventional Commits (required)

```
<type>(<scope>): <description>      # imperative, <72 chars, no trailing period

[optional body — the what and why, wrapped at 72]

[optional footer — Closes #123 / BREAKING CHANGE: …]
```

| Type | Use for |
|---|---|
| `feat` | New user-visible capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Behaviour-preserving code change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `build` / `ci` | Toolchain / workflows |
| `chore` | Everything else (no src behaviour) |
| `restructure` | Repo-shape moves (house type — e.g. the backend/frontend split) |

**Scopes** come from the module you touched:
- Backend: the `internal/` package — `feat(booking): add 60s cancel-window guard`,
  `fix(ledger): …`, `feat(ops): auto-assign consumer`, `docs(topics): …`
- Frontend: the app or package — `feat(customer): booking countdown`,
  `fix(admin): shell breakpoint`, `feat(landing): hero scroll story`,
  `chore(api-client): regenerate`
- Cross-cutting: `docs(workflows)`, `ci(frontend)`, `build(backend)`

Breaking change ⇒ `!` after scope + a `BREAKING CHANGE:` footer (e.g. an OpenAPI
contract change that forces a client regeneration).

Write in imperative mood ("add", not "added"/"adds"). Body explains what/why, never how.

## Branches

Format: `<type>/<kebab-description>` off `developer` (the integration branch).
Existing house prefix `feat/` stays primary; also allowed: `fix/`, `docs/`, `chore/`,
`hotfix/`, `refactor/`. Examples from history: `feat/backend-arch-review`,
`feat/booking-workflow-docs`, `feat/be-fe-restructure`.

Never commit directly to `developer`/`main`. Commit/push **only when the user asks**;
pushes run from the user's shell (`! git push …`).

## Before committing (checklist)

- [ ] Commits are atomic — one logical change each
- [ ] Backend touched ⇒ `make -C backend check` green; contract changed ⇒ `make openapi` + client regen in the same PR
- [ ] Frontend touched ⇒ `turbo build/typecheck`, `lint`, `format:check`, `i18n:check` green
- [ ] No debug logging; no commented-out code
- [ ] Changed folders' `CLAUDE.md` updated in the same commit

## PR description template

```markdown
## Summary
One paragraph: what and why.

## Changes
- Bullet the concrete changes

## Testing
- [ ] Backend: make check
- [ ] Frontend: turbo build/typecheck/lint/i18n
- [ ] Manual verification (sim/emulator/browser) — say what was checked

Closes #<issue>
```
