# apps/admin/src/features/providers/components

Scope: Presentational pieces of the five provider screens. No data fetching, no route decisions beyond a `Link`.

Purpose: Keep every screen file under the 150-line cap by owning one visual idea each, and keep the desktop and mobile surfaces sharing the same pieces wherever the design does.

Contents:

**Shared vocabulary**

- `SectionLabel.tsx` — the uppercase caption over each group of facts.
- `Rating.tsx` — `RatingValue`, the ★ (U+2605) glyph the fonts carry for exactly this.
- `ProviderStatusIndicator.tsx` — live statuses as a tinted ui-web `StatusPill` carrying the `StatusDot` and its word; suspended/offboarded keep the Ban-marked pill, because a standing decision has to read as blocked. Also exports `AVATAR_STATUS_FOR_PROVIDER`.
- `MetricTile.tsx` — one performance figure on the inset tile fill, its §6.16 band colour, a ui-web `ProgressBar` for rates and a sparkline for counts/ratings (desktop only).
- `ProgressMeter.tsx` — document completeness as a real `progressbar`.
- `PageBody.tsx` — `DesktopMain`, `MobileScroll`, `SectionGap`. **Candidates for `layouts/`** once a second feature needs them.
- `ActionBar.tsx` — the mobile sticky footer. Same promotion note.
- `StepUpChallenge.tsx` — the §5.5 fresh-verification prompt. **Candidate for `components/ui/`**: every destructive feature needs one.
- `DiscardChangesDialog.tsx` — "Discard changes?" on backing out of a dirty flow.

**Roster** — `SupplyBanner.tsx` (tinted warning Card on desktop + mobile card), `RosterFilterBand.tsx` (labelled FilterBand Card: search, skill Combobox, zone/status selects — state lives in `useProviderRoster`), `RosterCard.tsx`, `RosterTable.desktop.tsx` (AvatarLabel identity cells with the skills sub-line, in a flush Card; takes `staleAgeMs` and swaps LAST SEEN for the same stale warning pill the mobile cards wear), `ApplicationsEntryRow.tsx` (count StatusPill). (`RosterCountTags` was removed: the segments and footer already carried its numbers — the screen shows a single "N suspended" warning tag instead.)

**Profile** — `ProviderRecordHead.desktop.tsx`, `ProviderIdentity.mobile.tsx`, `ProviderProfileSections.mobile.tsx`, `ProviderLiveCard.tsx` (its `hasExpiredCredential` prop demotes a green pulsing "Available" to a still warning dot + "Available — expired credential", so the card never contradicts the expiry banner), `LocationThumb.tsx`, `ProviderSkillsCard.tsx`, `ProviderDocumentList.tsx`, `ProviderMetrics.tsx` (desktop: escalation full-width over a 2×2 — five tiles in a plain grid left a hole), `ProviderRecentJobs.tsx` (the desktop table renders full-width below the profile grid so Amount stays visible at 1440), `ProviderSideCards.tsx` (feedback / flags / payouts), `ProviderBanners.tsx` (suspension, expiry, offboarded).

**Suspend flow** — `SuspendImpactCard.tsx`, `SuspendActionTypes.tsx` (duration Segmented uses compact `durationDaysShort` "1d/3d/7d/30d" labels so it fits its card), `SuspendReasonFields.tsx`, `SuspendStepJobs.tsx`, `ActiveJobCard.tsx` (the reassign button names its target from `suggestedProviderName`), `SuspendStepConfirm.tsx`.

**Applications** — `ApplicationAge.tsx` (ageing pill + completeness), `ApplicationsTable.desktop.tsx` (decided rows fade under an "Already decided" group header inside the pending segment), `ApplicationCard.tsx` (danger edge on the same >5-day threshold as the pill and row tint), `ApplicantCard.tsx`, `ApplicationDocumentList.tsx`, `ApplicationReviewSections.mobile.tsx` (background check lives in `ApplicationFacts` only — no duplicate section), `ApplicationStateBanners.tsx`, `ReviewerNotesCard.tsx` (an explicitly-unsaved draft: no submit button until a notes mutation exists), `RejectApplicationForm.tsx` (its `serverNoteError` renders the server's 422 ON the note field), `RejectApplicationDialog.tsx` (the commit button says "Reject application", never a bare "Confirm"; `noteError` keeps the dialog open under a server refusal), `DocumentFilmstrip.desktop.tsx`, `DocumentViewer.desktop.tsx`.

A11y: wherever an avatar sits beside its printed name (tables' AvatarLabel cells, roster cards, record heads, the suspend rail footer), the avatar is wrapped `aria-hidden` so the name is announced once.

Business logic: only the rules that are inseparable from what is drawn — the ageing thresholds on the pill, the "unresolved" marker on a live job, the 20-character floor on a rejection note. Everything else is a prop.

Dependencies: `../../../components/ui`, `@sethu/ui-web` directly for the global anatomy pieces the adapters don't wrap (`CardHeader`/`CardContent`, `IconChip`, `StatusPill`, `AvatarLabel`, `FilterBand`/`FilterField`, `Combobox`, `Select`, `ProgressBar`, `PageHeader`), `../../../lib/{cx,format}`, `../../../routes/routes.constants`, `@sethu/i18n`, lucide-react.

Boundaries:

- **No BEM class from `styles/components.css`.** Only `components/ui/*` and `layouts/*` may use those; everything here composes primitives plus token-backed Tailwind utilities.
- No arbitrary Tailwind values (`w-[96px]`, `text-[#hex]`). `LocationThumb` and `DocumentViewer` size themselves from an SVG viewBox and percentage widths for exactly this reason.
- Colour never carries meaning alone: every dot has a label, every pill has its word, every band colour sits beside the number it qualifies.
- No sibling-feature imports; no data fetching.

Impacted modules: the five screens in the parent folder.
