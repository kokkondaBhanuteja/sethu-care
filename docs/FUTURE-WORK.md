# SETHU-CARE — Future Work (deferred, intentional)

A record of architectural improvements we've **agreed on but deliberately deferred** — each is
low-risk and fits the modular monolith (no Kafka, no microservices, no rewrite). Captured from a
staff-level architecture review so the reasoning survives and we implement them when the need is
real, not speculatively. Items are ordered by likely priority.

Two items from that review are **already done** (see "Done" at the bottom) — they're recorded so we
don't re-open them.

---

## 1. Generic audit log for admin actions
**What:** an `audit_logs` table — `id, actor_user_id, entity, entity_id, action, metadata (jsonb),
created_at` — plus a thin `internal/audit` writer, appended to (append-only, like the ledger).

**Why deferred:** today the high-value trails already exist — `booking_events` (every transition,
with `actor_user_id`), the append-only `ledger_entries`, and `notification_log`. A generic audit
trail matters once the **admin surface grows** (refund overrides, technician management, catalog
edits, config changes) — actions that don't live on a booking.

**Trigger to build:** the first admin action that mutates state **outside** a booking's event
stream. Keep it a plain append-only table; do not turn it into event sourcing.

## 2. Scheduler for recurring background jobs
**What:** one `internal/scheduler` package owning recurring work (a ticker loop or a small cron),
instead of scattered `go foo()` calls in `main`.

**Likely jobs:** expire/purge old `otp_challenges`; booking reminders; retry stuck notifications;
reconcile PENDING payments against the PSP; nightly analytics aggregation.

**Why deferred:** nothing recurring exists yet — OTP rows simply expire lazily (checked at verify
time), and the **outbox worker** is already the one managed background loop. Adding a scheduler now
would be infrastructure with no jobs to run.

**Trigger to build:** the first genuine recurring job (most likely OTP cleanup or payment
reconciliation). Model it on the outbox worker's lifecycle (context-cancelled shutdown, logged).

## 3. Per-module internal layering (`domain/` · `application/` · `infra/`)
**What:** for a module that grows large, split its `service.go`/`state.go`/`queries` into
`domain/ application/ infra/` sub-packages.

**Why deferred:** premature at the current size — modules are still small enough to hold in one's
head, and the split adds navigation overhead with no payoff yet. This is a **per-module, as-needed**
refactor, not a project-wide standard.

**Trigger to build:** a single module whose files/responsibilities have clearly outgrown a flat
package (booking is the likeliest first candidate).

## 4. Broaden fast unit-test coverage
**What:** add more pure-function unit tests where logic is non-trivial (pricing/quote math, ledger
attach rules, ops candidate-ranking scoring), to complement the real-DB integration tests.

**Why deferred (partial):** the genuinely pure pieces — the **state machine** (all 169 state×action
combos) and **money** — are already fast unit tests. Services are integration-by-design against real
PostGIS (testcontainers), because mocking pgx costs more than it buys and would weaken the
correctness guarantees. This is additive, not a change of approach.

**Trigger to build:** any new non-trivial pure logic ships with its own unit test; backfill the
highest-value existing calculators opportunistically.

---

## Considered and intentionally NOT adopted

- **Colocating transport with modules** (e.g. `booking/routes.go`). **Rejected — keep transport in
  `internal/httpapi`.** No domain package imports huma today; that's exactly what lets a service be
  driven by a different transport (gRPC, a queue consumer) without change. `httpapi.RegisterAll`
  already gives the "one wiring list" benefit without coupling every module to huma/HTTP. Revisit
  only if the transport-agnostic property is explicitly abandoned.
- **Microservices, Kafka/RabbitMQ, CQRS-everywhere, event sourcing, an ORM, a DI framework,
  hexagonal-per-package.** Out of scope by design — the app is correctly sized for a modular
  monolith; the **transactional outbox** covers async needs without external messaging.

---

## Done (recorded so we don't re-open them)

- **Module dependency rule, CI-enforced** — the allowed-import graph is now a `depguard` rule in
  `.golangci.yml` (`cores-must-not-import-consumers`, `money-is-a-pure-leaf`): a core importing a
  consumer, or `money` importing any domain package, **fails the build**. Extends the existing
  state-machine purity guard. (Verified live — it correctly flagged, then we scoped it to
  production files.)
- **Thin composition root** — the outbox consumer wiring moved out of `cmd/api/main.go` into
  `internal/app/RegisterConsumers` (mirrors `httpapi.RegisterAll`), so `main` stays small as
  consumers multiply. Behaviour is identical; `make check` green.
