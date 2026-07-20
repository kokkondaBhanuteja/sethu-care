# Architecture Rules

## Purpose
Define the target architecture for the SETHU-CARE Go backend so every change reinforces it.
The authoritative source is `docs/architecture/BACKEND-ARCHITECTURE-REVIEW.md` (Phases 1–4);
this file is the skimmable rule set. Do not contradict the review.

## Rules
1. Treat the backend as a **modular monolith with DDD bounded contexts and a hexagonal edge** —
   one package per context under `internal/`. Keep contexts talking through **events on the
   transactional outbox**, not by reaching into each other's tables.
2. Point every dependency **inward**: Transport → Assembly → Domain → Adapters/Kernel → Postgres.
   Never invert an arrow (a domain must not import transport, a core must not import a consumer).
3. Enforce exactly one writer per aggregate. Only `booking` writes `bookings`, only `ledger`
   writes `ledger_entries`/`payments`, etc. (full map in review Phase 5).
4. Keep outbound integrations (`sms`, `media`, `razorpay`, `notifications.Sender`) behind Go
   interfaces (ports); choose the dev vs prod implementation only in the composition root
   (`cmd/api/main.go`).
5. Domain services depend **directly on `internal/storage/sqlcgen`** — this is a deliberate,
   sqlc-idiomatic choice, not an oversight. Do NOT introduce a repository-interface layer
   (see `repository-rules.md`).
6. Keep `internal/money` and `internal/flow` as pure/degrading leaves; keep `internal/config`
   a leaf passed by value into constructors — never imported by domains.
7. Machine-enforce the direction with **depguard** (`.golangci.yml`): `cores-must-not-import-consumers`,
   `money-is-a-pure-leaf`, and the booking-state-machine purity rule. Add new forbidden edges there,
   not just in review.
8. Configuration lives only in `internal/config`: `os.Getenv` + typed helpers, defaulted,
   `godotenv` non-overriding. No inline magic numbers for tunables (see `coding-standards.md`).

## Examples
- Dependency direction and the allowed/forbidden import table: review §"Phase 3/4" and
  `folder-rules.md`.
- Ports chosen in the composition root: `cmd/api/main.go` wires `LogSender` vs `MSG91`.
- Event-driven contexts: `internal/booking/service.go` inserts an outbox row; consumers wire up in
  `internal/app/consumers.go` (`dispatcher.Subscribe("booking.completed", …)`).
- Pure leaf value object: `internal/money/money.go` (`type Money int64`, no internal imports).

## Anti-patterns
- A domain package importing `httpapi`, `huma`, `config`, or `net/http` as a server — inverts the
  arrows and breaks the hexagon.
- One context reading/writing another context's tables directly instead of consuming its event.
- Adding a generic `BaseService`/repository framework "for reuse" — fights sqlc and per-context
  ownership (review Phase 8 explicitly says don't).
- Putting business decisions in the composition root; `cmd/api` only wires.

## Checklist
- [ ] New code respects the inward dependency direction (no domain→transport/config).
- [ ] Only the owning service writes its aggregate; cross-context needs go through an event.
- [ ] New outbound integrations sit behind a port chosen in `cmd/api/main.go`.
- [ ] Any new forbidden import edge is added to depguard in `.golangci.yml`.
- [ ] `make check` (lint incl. depguard + `-race` tests) passes.
