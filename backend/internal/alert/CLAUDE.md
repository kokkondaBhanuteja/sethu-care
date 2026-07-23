# internal/alert — CLAUDE.md

## Purpose
The admin console's alert model: the persisted feed, acknowledgement (ownership) state, handover notes, and the ENGINE that turns domain events into alert rows. Alerts are persisted, not projected — acknowledgement must survive restarts, replays and two admins racing.

## Responsibilities
- **Engine**: `RecordBookingEscalation(ctx, sourceEventID, bookingID)` — the outbox consumer for `booking.escalated` (wired in `internal/app`): one CRITICAL, acknowledgement-requiring alert per escalation. Idempotent twice over: `source_event_id UNIQUE` (redelivery) + one OPEN alert per `(kind, subject)` partial unique (re-fire while owned). Today this is the ONLY producer; the other kinds are declared vocabulary awaiting their engines.
- **Feed**: `List(ctx, Filter{Severity, Acknowledged *bool, Limit, Cursor})` — newest first, keyset cursor (limit+1 peek), whole-set total, booking context (service/city) joined read-only at read time.
- **Detail**: `Get(ctx, id)` — resolves the id as `alerts.id` FIRST, then as a SUBJECT (booking) id → that subject's newest alert. This is the documented ID SCHEME: phase-1's attention queue advertised `alertId = booking id`, and the fallback keeps that convention working. Returns related alerts (same subject), the booking's transition history (state codes), `EscalatedFrom` (the state the booking escalated out of), and notes.
- **Acknowledge**: `Acknowledge(ctx, id, adminID)` — first-writer-wins UPDATE (`WHERE acknowledged_at IS NULL`); winner's `audit.Record` (`ALERT_ACKNOWLEDGE`, entity_type `alert`) commits in the SAME tx via `storage.InTx`. Replay by the winner → `wonRace=true`, no second audit row; a late admin → 200 with `wonRace=false` and the winning acknowledgement.
- **Read-all**: `ReadAll(ctx)` — marks `read_at` on rows with `requires_acknowledgement = false` only (badge discipline: read-all must never silence a critical); returns the honest count, zero on replay.
- **Notes**: `AddNote(ctx, id, authorID, idempotencyKey, body)` — unique `(alert_id, author, key)`; a replayed key returns the first note.
- **Band/badge**: `Band(ctx)` (open-critical count + ≤2 newest examples), `CountOpenCritical(ctx)` (the shell badge).

## Owns
`alerts`, `alert_notes` (migration `00019_alerts.sql`).

## Allowed Dependencies
`audit` (Record, same-tx), `money`, `storage` (+`sqlcgen`), `pgx`/`pgxpool`, `google/uuid`, stdlib.

## Forbidden Dependencies
No `httpapi`/`huma`/`config`; no other domain module's Go API (booking context is joined read-only in SQL).

## Contains
- `enums.go` — `Kind` (9 values), `Severity` (3), `SubjectKind` (2); UPPER_SNAKE, full `AllX()`/`Valid()`/`ParseX()`/`String()` pattern, drift-tested against the `alerts` CHECKs in `internal/schema`.
- `service.go` — `Service`/`NewService(pool)`, the methods above, `ErrAlertNotFound` (→404), `ErrInvalidCursor` (→400), feed cursor codec.
- `service_test.go` — testcontainers coverage: engine idempotency, acknowledge race/replay/audit, read-all discipline, subject-id resolution, replay-safe notes, ordering + cursors.

## Examples
```go
alerts := alert.NewService(pool)
// wired as the booking.escalated outbox consumer (internal/app):
err := alerts.RecordBookingEscalation(ctx, event.ID, event.AggregateID) // idempotent
listed, wonRace, err := alerts.Acknowledge(ctx, alertOrBookingID, adminID)
```

## Best Practices
- The wire's camelCase spellings (`bookingEscalated`, `critical`) are httpapi's; this package speaks UPPER_SNAKE only. Map at the transport boundary.
- Never insert an alert outside `InsertSubjectAlert`'s ON CONFLICT DO NOTHING path — both idempotency guards live on that write.
- Adding a Kind means: constant + `AllKinds()` + migration CHECK + drift test entry + httpapi mapping, in one PR.

## Common Mistakes
- Letting read-all touch the critical tier (the SQL guard exists precisely for this).
- Writing the acknowledge audit row outside the acknowledgement's transaction.
- Treating a lost acknowledge race as an error — it is a 200 with `wonRace=false` by contract.
