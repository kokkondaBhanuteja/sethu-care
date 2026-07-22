# apps/admin/src/features/providers

Scope: The supply side of the console — the provider roster, the provider record, the
suspend / block / force-offline flow, and the application pipeline that feeds new providers in.
Spec: Admin-Mobile-App.md §6.15–§6.19 (plus §5.5 step-up, §7.5 the application→approval flow and
§10.3 the risk register).

Purpose: Answer "who can I put on this job", "should this provider still get work", and "who is
waiting to join". Supply is the constraint this product lives or dies by, which is why the roster
leads with a zone shortfall rather than a list.

## Contents

| File | Responsibility |
| --- | --- |
| `ProviderRoster.{desktop,mobile}.tsx` | BOX 20/21, M34–M37 — table vs stacked cards over one hook |
| `ProviderProfile.{desktop,mobile}.tsx` | BOX 39–42, M63–M68 — the record and its five actions |
| `SuspendProvider.{desktop,mobile}.tsx` | BOX 36–38, M60–M62 — the four-step destructive flow |
| `ApplicationsQueue.{desktop,mobile}.tsx` | BOX 43/44, M69/M70 |
| `ApplicationReview.{desktop,mobile}.tsx` | BOX 45–47, M71–M74 |
| `rosterFilters.ts` (+ test) | Pure client-side roster refinements: skill/zone/status filtering, option derivation |
| `providers.api.ts` | THE data boundary. Every endpoint this feature needs, in one file |
| `providers.types.ts` · `suspend.types.ts` · `applications.types.ts` | The normative shapes |
| `providers.constants.ts` | Query keys, segment/reason vocabularies, copy-key lookups, §6.16 bands |
| `providerFixtures.ts` · `providerProfileData.ts` · `applicationFixtures.ts` | Fixture data |
| `providers.mock.ts` · `providerProfiles.mock.ts` · `suspend.mock.ts` · `applications.mock.ts` | Mock services |
| `components/` · `hooks/` · `queries/` · `mutations/` | Each with its own `CLAUDE.md` |

## The desktop page language (digestibility redesign)

Desktop screens follow the approved ui-web Figma language: `PageHeader` in the content column
(the shell `Topbar` takes a crumb, so the visible page title lives with the content), a labelled
`FilterBand` Card on the roster (search + skill Combobox + zone/status selects — state in
`useProviderRoster`, filtering in `rosterFilters.ts`), `Segmented` segment switches, and every
table in a flush white Card. Record/queue cards use the icon-headed `CardHeader` + soft `IconChip`
anatomy (Live = blue Activity, Performance = green ChartColumn, Skills = purple Wrench,
Documents = amber FileText, Recent jobs = blue Briefcase, Auto-validation = teal ScanSearch).
The supply shortfall renders as a tinted warning Card above the roster, expiring/expired documents
as warning/danger pills, and application ageing keeps one severity encoding everywhere: amber past
2 days, red past 5 (§6.17).

## Business logic

- **Supply health.** The roster's shortfall strip is present or absent — never a green "supply is
  fine" band, because a permanent slot for reassurance trains the eye to skip the place the warning
  appears. The count line says either "Kompally has 2 of the 5 providers this zone needs" or "every
  zone is at or above its provider threshold".
- **Status is never colour alone.** Free / on job / offline are a dot plus their word; suspended and
  offboarded swap the dot for a labelled pill, because a standing decision has to read as blocked
  rather than merely absent.
- **Performance carries no acceptance rate.** Dispatch is automatic (docs/Booking-Workflow-Decisions.md),
  so escalation rate sits where other marketplaces put acceptance, and the screen says so out loud.
- **Suspension is four deliberate steps** and step 3 is the point of the whole flow: every active
  booking must be explicitly reassigned or allowed to finish before the suspension can proceed.
- **Risk policy is read, never restated.** `suspendProvider` (high), `blockProvider` (critical) and
  `forceProviderOffline` (medium) — and `approveApplication`, `rejectApplication`,
  `requestDocuments` — come from `lib/permissions/actions.ts` via `useActionPolicy` / `useStepUp` /
  `useUndoableAction`. Nothing in this folder hardcodes a step-up requirement or an undo window.
- **The approval gate is server-enforced.** The console mirrors `approvalBlockers` so the reason
  sits above the dead Approve button; it never decides on its own that approval is allowed.
- **Already-decided is informational.** Another admin deciding first is a legitimate outcome, so it
  renders a success/danger banner over a dimmed record — never an error state.

## Reaching each designed state

Mock data is deterministic. `VITE_MOCK_MODE=error|empty|slow` still drives the error, empty and
skeleton states on every screen; these ids drive the design's own states:

| State | How to reach it |
| --- | --- |
| Roster, low supply (BOX 20 / M34) | `/providers` |
| Roster, healthy supply (BOX 21 / M35) | `/providers?state=healthy` |
| Roster, offline / stale statuses (M36) | `/providers?state=stale` |
| Roster, filtered empty (M37) | `/providers` then search for a name that matches nothing |
| Profile, healthy (BOX 40 / M65) | `/providers/PRV-882` |
| Profile, poor performer (BOX 41 / M66) | `/providers/PRV-907` |
| Profile, expired documents (BOX 42 / M67) | `/providers/PRV-884` |
| Profile, already suspended (BOX 39 / M63) | `/providers/PRV-885` |
| Profile, offboarded (M68) | `/providers/PRV-886` |
| Suspend flow with active jobs (BOX 36–38 / M60–62) | Suspend from `PRV-882` or `PRV-907` |
| Suspend flow with no active jobs (skips step 3) | Suspend from `PRV-884` |
| Undo toast (M64) | Complete any suspension — the 10s window comes from the risk register |
| Applications queue (BOX 43 / M69) | `/providers/applications` |
| Applications empty (BOX 44 / M70) | `VITE_MOCK_MODE=empty` |
| Application review (BOX 45 / M71) | `/providers/applications/APP-4471` |
| Reject modal (BOX 46 / M72) | Reject from `APP-4471` |
| Approve blocked (BOX 47 / M73) | `/providers/applications/APP-4473` — police verification missing |
| Already decided (M74) | `/providers/applications/APP-4460` |

Known fixture wrinkle, matching the artifact: the roster marks Mohan Das (`PRV-907`) suspended
while BOX 41 draws his profile as an on-job poor performer. The two artboards disagree; the roster
row follows BOX 20 and the profile follows BOX 41.

## Dependencies

`components/ui/*`, `components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar}`,
`lib/{format,cx,http,permissions,toast}`, `hooks/{useBreakpoint,useDebouncedValue,useStepUp,useUndoableAction}`,
`routes/routes.constants`, `@tanstack/react-query`, `@sethu/i18n` (namespace `adminProviders`),
lucide-react.

## Boundaries

- Never imports a sibling feature. Reassignment from step 3 records the decision and hands the
  booking id to the backend payload — it does not reach into the booking-actions feature.
- Pages import from here; this folder never imports a page.
- No BEM class from `styles/components.css` and no arbitrary Tailwind values — see
  `components/CLAUDE.md`.
- Components never import a `*.mock.ts`; `providers.api.ts` is the only file that does.

## Impacted modules

`pages/{ProviderRosterPage,ProviderProfilePage,SuspendProviderPage,ApplicationsQueuePage,ApplicationReviewPage}.tsx`,
the Providers tab in both shells, and `queries/useShellCounters` (its `pendingApplications` badge
counts the same queue this feature renders).
