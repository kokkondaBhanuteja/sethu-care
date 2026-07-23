# internal/providerops — CLAUDE.md

## Purpose
The admin console's supply side: the provider roster and profile read models, the standing
writes (suspend / block / force-offline / restore), and the provider-application pipeline
(approve / reject / request documents). The consumer twin of `ops` that OWNS tables: where
`ops` composes read models over other modules' aggregates, providerops does the same for
reads but also owns the admin-imposed provider state.

## Responsibilities
- `Roster(RosterInput)` — derived live statuses (BLOCKED→offboarded, live SUSPENDED→suspended,
  active booking→on_job, online+fresh→free, else offline; freshness = GREATEST(updated_at,
  last_location_at) within 15 min), segment counts under the search filter, keyset cursor on
  (name, id) with the limit+1 peek, zone shortfall (Go const threshold 3 — no per-zone config
  exists yet), pending-applications summary.
- `Profile(id)` — identity + standing + aggregates from real bookings/reviews: 90-day metrics
  in 8 buckets (completion, escalation, cancellation, rating, jobs30 — **no onTime**: no
  promised-arrival data exists), today/cycle figures dated by the COMPLETED booking_event.
- `ActiveJobs(id)` — step 3 of the suspend flow; reassignment suggestion via `ops.Candidates`
  (the REAL dispatch ranking) minus the provider in question; EtaMinutes always nil (no ETA engine).
- `Suspend/Block` — one tx: exists → version CAS → every live job resolved or
  `UnresolvedJobsError` (422) → standing upsert → `audit.Record`. Post-commit, reassign-resolved
  bookings are ESCALATEd via `booking.Apply` (best-effort; already-moved is success).
- `ForceOffline` — version bump + `identity.SetAvailabilityIn(tx, …, false)` + audit, one tx.
- `Restore` — SUSPENDED/BLOCKED → ACTIVE (else `ErrNotRestricted` 422), audited.
- Applications: `Applications` (oldest-first keyset queue), `Application` (review with
  SERVER-computed `ApprovalBlockers` + derived `AutoValidation` — only checks with real data:
  EXPIRY, OCR; never BLUR), `Approve` (blockers clear → `identity.ProvisionTechnician` in the
  same tx → the applicant can OTP-login immediately), `Reject` (≥20-char note, terminal),
  `RequestDocuments` (missing rows + awaiting_docs).

## Owns
`provider_admin_states` (current standing + the provider-mutation version token; absence =
ACTIVE at version 0; history is audit_logs), `provider_applications`,
`provider_application_categories`, `provider_application_documents`. Queries in
`db/queries/provider.sql`.

## Allowed Dependencies
`identity` (provisioning + availability, via tx-aware methods), `ops` (candidate ranking),
`booking` (ESCALATE command), `audit`, `storage(+sqlcgen)`, `money`, stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
`httpapi`/`huma`/`config`; `ledger`. Never writes users/technicians/bookings directly — those
writes go through their owning services.

## Contains
- `providerops.go` — `Service`, `NewService(pool, identity, ops, booking)`, the error family:
  `ErrProviderNotFound`/`ErrApplicationNotFound` (404), `ErrInvalidCursor` (400),
  `StaleVersionError` (409, VERSION_CONFLICT body), `AlreadyDecidedError` (409,
  ALREADY_DECIDED body), `UnresolvedJobsError`/`ApprovalBlockedError`/`ErrDurationRequired`/
  `ErrNotRestricted`/`ErrNoteTooShort`/`ErrNoDocumentsRequested` (422),
  `ErrApplicationDecided` (409).
- `enums.go` — drift-tested persisted enums: `Standing` (UPPER), `SuspendReason`,
  `ApplicationStatus`, `RejectReason` (lowercase — stored as the FROZEN admin contract spells
  them, on purpose), `DocumentType` (UPPER codes), `DocumentValidation`; plus derived
  (non-persisted) vocabularies `ProviderStatus`, `JobStage`, `JobResolution`, `BlockerCode`,
  `AutoCheckCode`.
- `roster.go`, `profile.go`, `standing.go`, `applications.go` — as above.

## Best Practices
- Suspension/block must keep the unresolved-jobs gate — never land a standing change that
  strands a live booking silently.
- The eligibility consequence lives in `ops.sql ListCandidateTechnicians` (NOT EXISTS over
  provider_admin_states) — keep the exclusion and the standing vocabulary in sync.
- Every standing/application write is one `storage.InTx` with the CAS and its `audit.Record`.
- New enum value = Go constant + migration CHECK + `internal/schema/drift_test.go` entry, same PR.

## Common Mistakes
- Deriving roster status in more than one place — the CASE lives in `provider.sql` (roster,
  counts, zone supply, profile all share it verbatim); change all four together.
- Writing `technicians.is_online` here instead of through `identity.SetAvailabilityIn`.
- Treating a version-0 provider (no standing row) as missing — absence is ACTIVE at version 0.
- Claiming data that does not exist: documents/flags on the profile are honestly empty, ETA is
  nil, onTime does not appear. Do not invent them; build their sources first.
