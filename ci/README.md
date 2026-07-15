# CI templates

Staged here because writing to `.github/workflows/` is blocked in the dev sandbox — installing CI
should be a deliberate step anyway. Move them into place:

```bash
mkdir -p .github/workflows
git mv ci/backend.yml   .github/workflows/backend.yml
git mv ci/mobile.yml    .github/workflows/mobile.yml
```

## Workflows

- **backend.yml** — Go: build, `golangci-lint` (incl. the depguard module-dependency rules), the
  OpenAPI drift guard (`cmd/genopenapi` vs the committed `api/openapi.yaml`), and `go test -race`
  (testcontainers use the runner's Docker). Job name: `backend`.
- **mobile.yml** — pnpm: install (frozen lockfile), the generated-client drift guard (regenerate
  from `api/openapi.yaml` and diff), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`. Job name:
  `mobile`.

## Ruleset (`ruleset-main.json`)

A GitHub repo **ruleset** protecting the default branch: requires a PR (1 approval), a linear
history, and the **`backend`** and **`mobile`** status checks to pass before merge. Import it in
**Settings → Rules → Rulesets → New ruleset → Import a ruleset**. (The `~DEFAULT_BRANCH` condition
tracks whatever the default branch is.)
