# Folder Rules

## Purpose
Pin the responsibility and the import box of every package so a change lands in the right folder and
crosses no forbidden edge. Grounded in review Phase 3 (folder table) and Phase 4 (dependency rules).

## Rules
1. Put each bounded context in its own `internal/<context>` package; it **owns** exactly the tables
   listed for it and nothing else writes them.
2. Respect the layer boxes: **Transport** (`httpapi`, `auth`, `shared/response`) → **Assembly**
   (`app`) → **Domain** (`booking`, `ledger`, `catalog`, `identity`, `verification`, `ops`,
   `address`, `reviews`, `notifications`, `gateway`, `audit`, `order`) → **Adapters** (`sms`,
   `media`, `razorpay`) + **Kernel/Platform** (`money`, `flow`, `config`, `storage`) → **Postgres**.
3. Honour the "May import / Must NOT import" table below (from review Phase 3). depguard enforces the
   load-bearing rows.
4. `internal/app` is the only package allowed broad domain imports (assembly of outbox consumers);
   it is explicitly exempt from `cores-must-not-import-consumers`.
5. `cmd/api` is the composition root — it may import everything; `cmd/genopenapi` imports only
   `httpapi` + `auth` (nil services).
6. `internal/storage/sqlcgen` is **generated** — never hand-edit; regenerate with `make generate`.
7. `internal/schema` is test-only (enum↔DB-CHECK drift); production code must not import it.

### May import / Must NOT import (key rows)
| Folder | Owns | May import | Must NOT import |
|---|---|---|---|
| `httpapi` | — | domain services, `auth`, `money`, `flow` | DB directly, another domain's transport |
| `auth` | — | `identity` (Role), `shared/response` | any domain service, storage |
| `booking` | `bookings`,`booking_items`,`booking_events` (writes `orders`,`outbox`) | `identity`,`money`,`flow`,`audit`,`storage(+sqlcgen)` | `httpapi`, ledger/notifications/ops (consumers) |
| `ledger` | `ledger_entries`,`payments` | `booking`,`money`,`storage(+sqlcgen)` | `httpapi`, `config` |
| `catalog`/`identity`/`address`/`reviews` | own tables | `money`/`storage(+sqlcgen)` as noted | any consumer, `httpapi` |
| `ops` | — (cross-reads) | `booking`,`identity`,`money`,`sqlcgen` | `httpapi`, `ledger` |
| `money` | — | — (pure leaf) | **anything** internal (`money-is-a-pure-leaf`) |
| `flow` | — | `go-redis` only | anything internal |
| `config` | — | `godotenv`, stdlib | **anything internal** |
| `storage`(+`sqlcgen`) | — | `pgx`, `sqlcgen` | domains, `config` |

## Examples
- `internal/booking/permission.go` imports `identity` only for `Role` — allowed.
- `internal/httpapi/errors.go` imports several domain packages to classify errors — allowed transport.
- The full box table and adjacency graph: review Phase 3 & 4.

## Anti-patterns
- A "core" (`order`/`identity`/`auth`/`catalog`/`address`/`booking`) importing a consumer
  (`ledger`/`notifications`/`verification`/`ops`/`reviews`/`media`) — blocked by depguard.
- Reaching into `sqlcgen` from a package that doesn't own the table.
- Dumping shared helpers into a generic `utils/`/`common/` package (review Phase 7 forbids this).

## Checklist
- [ ] New file is in the package that owns its aggregate/concern.
- [ ] Its imports respect the box table above.
- [ ] No production import of `internal/schema`.
- [ ] Generated `sqlcgen` regenerated (`make generate`) rather than edited.
