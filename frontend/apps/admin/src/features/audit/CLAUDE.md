# apps/admin/src/features/audit

Scope: The append-only audit log — `/audit` (desktop BOX 48/49/50, mobile BOX 75/76/77/78) and the
audit entry detail. Spec §6.29 (screen) and §10.4 (the normative entry schema).

Purpose: Accountability. Spec §10.1 puts one full-access admin role in v1 and states that
**accountability comes from audit, not from restriction** — which makes this screen the thing that
makes "who did this?" provable. It matters more than its size suggests.

## The one rule this folder exists to protect

**The log is append-only.** There is no edit affordance, no delete affordance, no bulk action and
no overflow menu anywhere in this feature, and there is no write function in `audit.api.ts` or
`audit.mock.ts`. "No audit-log editing or deletion" is a constraint preserved even for a full-access
admin (§10.1), and the API must reject writes rather than merely have no UI. The one affordance that
LOOKS like a control — the desktop header's **Export CSV** — is a client-side READ: `auditCsv.ts`
serialises the currently filtered, currently loaded entries into a Blob download
(`audit-log-YYYY-MM-DD.csv`) and touches nothing.

A correction is a **compensating entry**: a new, itself-audited action that reverses an earlier one.
Actions with no undo window — refund, manual completion (§10.3) — are corrected this way and no
other. `AuditCompensationNote` renders the link from both ends (`compensatesEntryId` /
`compensatedByEntryId`) so an operator reading either row can reach the other. Neither row carries an
"amended" flag: a flag would imply the original changed, and it did not (BOX 50).

## Contents

- `audit.types.ts` — the §10.4 schema, field for field, plus the two compensating-link fields the
  API contract owes. Vocabularies (`AUDIT_ACTIONS`, `AUDIT_TARGET_TYPES`, `AUDIT_RANGES`) live here.
- `audit.constants.ts` — query keys, page size, the `?entry=` param, and the vocabulary →
  presentation maps. `RISK_LEVELS` and `ADMIN_ACTIONS` are **imported** from
  `lib/permissions/actions`; this file only says how each value is drawn.
- `audit.api.ts` — the only boundary to data. Reads only, permanently.
- `audit.mock.ts` / `audit.fixtures.ts` / `audit.seeds.ts` / `audit.backlog.ts` / `auditSeed.ts` —
  the mock ledger: 15 design-exact entries plus 30 generated ones (45 total).
- `useAuditLog.ts` — filters, debounce, cursor paging. Both shells call it; neither owns a rule.
- `useAuditEntry.ts` — `useAuditSelection()` (the `?entry=` parameter) and the entry query.
- `AuditLogScreen.desktop.tsx` / `AuditLogScreen.mobile.tsx` / `AuditEntryScreen.mobile.tsx`.
  Desktop's filter band carries the complete filter set inline — there is deliberately no "More
  filters" drawer, because a second surface holding the same four selects only invites drift.
  Desktop's header action is Export CSV (see the rule above); the mobile entry screen wraps the
  def-list in the standard `Card` surface like every sibling detail screen.
- Presentation: `AuditLogTable` (passes the `?entry=` selection down as `selectedRowKey`, so the
  selected row is visibly tinted), `AuditEntryRow` (a stretched-button row with the target link
  stacked above it — a link inside a button is invalid HTML), `AuditTargetLink` (the target
  reference as a real react-router link to the record it names; row click selects, reference click
  navigates via `stopPropagation`; unroutable types — payments, devices — stay plain mono),
  `AuditDayList`, `AuditEntryDetail`, `AuditEntryFields`, `AuditDefList`, `AuditActionPill`,
  `AuditEvidenceTags`, `AuditCompensationNote`, `AuditImmutabilityStrip`, `AuditAppliedFilters`,
  `AuditFilterFields`, `AuditDetailPanel`, `AuditSkeletons`.
- Pure helpers: `auditChange.ts` (the `→` transition), `auditGrouping.ts` (IST day groups),
  `auditTarget.ts` (where a target reference navigates to), `auditCsv.ts` (+ unit tests — CSV
  serialisation, `audit-log-YYYY-MM-DD.csv` naming, Blob download).

## Privacy

`context.ipAddress` and `context.approximateLocation` render **only** in the detail view — never in
the list, never in a console statement, never in an analytics payload (spec §6.29, Privacy; §10.4
Location capture). The log records admin activity, not customer activity: evidence is shown as
counts, never as openable customer media.

## Mock triggers

`VITE_MOCK_MODE=error|empty|slow` drives the error / genuinely-empty / skeleton states.
Filtered-empty is reached by filtering, not by a mode.

| Trigger                                            | What it shows                                                                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aud_01J8XKQ2M4`                                   | The Admin spec §10.4 example, verbatim: Ravi Kumar (`adm_44`), `BOOKING_MANUAL_COMPLETE`, critical, `#B-8823`, reason `CUSTOMER_UNREACHABLE`, timestamp `2026-07-20T10:12:11.482Z`. |
| `aud_4c81de20`                                     | The refund the design's BOX 49 detail pane shows — ₹0 → ₹1,499 on `#B-8790`. Carries `compensatedByEntryId: "aud_c07b5512"`.                                                        |
| `aud_c07b5512`                                     | **The compensating entry (BOX 50).** Refund reversal on `#B-8790`, ₹1,499 → ₹0, `compensatesEntryId: "aud_4c81de20"`. Open it to see the correction relationship.                   |
| Filter Action type = Refund + Admin = Priya Sharma | The BOX 49 / BOX 77 filtered view.                                                                                                                                                  |
| Filter Admin = Anjali Rao + Date range = Today     | Filtered-empty (`FilteredEmptyState` with Clear filters).                                                                                                                           |
| Load more                                          | 45 entries in the ledger; 36 fall inside the default Last-7-days window, at a page size of 25 — so the second page is always one click away.                                        |
| Search `#B-8790`                                   | Returns exactly the compensating pair, which is the fastest way to see BOX 50.                                                                                                      |

"Now" for a named date range is the newest entry in the ledger, not the wall clock — the fixtures are
dated to the approved designs (20 Jul 2026) and a real clock would empty the log once that date
passed, which would look like a bug in the screen rather than in the fixture.

Business logic: none beyond presentation. This feature reads; it never mutates anything.

Dependencies: `components/ui/*`, `components/states/QueryBoundary`, `lib/permissions/actions`,
`lib/format`, `lib/http`, `hooks/useDebouncedValue`, `hooks/useBreakpoint`, `routes/routes.constants`,
`mocks/mockTransport`, `@sethu/i18n` namespace `adminAudit`.

Boundaries: no sibling-feature imports. Target references link outward through `ROUTES` only.
Never add a mutation here — if the product ever needs a correction flow, it belongs in the feature
that owns the action being corrected, and it lands in this log as a new entry.

Impacted modules: `pages/AuditLogPage.tsx`.
