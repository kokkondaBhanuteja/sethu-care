# apps/admin/src/features/providers/hooks

Scope: Screen logic for the providers feature — the state each screen needs, decided once for both shells.

Purpose: The anti-drift rule (spec §2.1). Desktop and mobile are separate components on purpose, so anything they could disagree about lives here instead of in either one.

Contents:

- `useProviderRoster.ts` — segment, debounced search, the roster query, the filtered-empty verdict, and the staleness verdict (a live status older than five minutes is a wrong answer, not stale detail). Reads the `?state=healthy|stale` variant switch documented in the feature `CLAUDE.md`.
- `useRosterSegmentItems.ts` — the three segment labels and their counts.
- `useProviderProfile.ts` — the profile query plus the derived action set: an offboarded provider has nobody left to call or suspend, and an already-suspended one is offered Restore rather than a second suspension.
- `useSuspendProviderFlow.ts` — the four-step state machine. Panes are 0 (action type + reason), 1 (active jobs) and 2 (confirm); `RAIL_INDEX_FOR_PANE` maps them onto the four rail stops. Step 1 skips straight to confirm when the provider has no live work.
- `useSuspendSteps.ts` — the rail's four labels.
- `useSuspendMessages.ts` — the summary line, the reason line and the message the provider actually reads, built once so the summary, the preview and the toast cannot disagree.
- `useApplicationsQueue.ts` — segment state and counts; `includeDecided` is the one surface difference.
- `useApplicationReview.ts` — the review query, the selected document (defaults to the one that failed, because that is what the decision turns on), and the decision mutations.

Business logic:

- **The approval gate is never computed here.** The server owns it and sends `approvalBlockers`; this feature mirrors them (spec §6.18).
- Continue is blocked on step 3 until every active job has an answer — the rule that stops an operator suspending someone mid-shift.
- A dirty flow prompts "Discard changes?" before it closes.

Dependencies: react, react-router, `../queries`, `../mutations`, `../../../hooks`, `../../../routes/routes.constants`.

Boundaries: no JSX, no direct API calls (queries and mutations only), no policy restated from `lib/permissions/actions.ts`.

Impacted modules: every screen in this feature.
