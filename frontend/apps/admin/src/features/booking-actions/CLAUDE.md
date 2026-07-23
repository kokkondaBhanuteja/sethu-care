# apps/admin/src/features/booking-actions

Scope: Every destructive and financial action the console can run against one booking — assign (rescue), cancel (emergency), re-dispatch, admin-verified manual completion, and refund. The highest-risk feature in the product.

Purpose: Make each of these actions _accountable, rare and measurable_ (spec §1.6) rather than merely possible. Every screen leads with the consequence, gates on a reason code, and either offers the undo window the risk register allows or explains why there is none.

Contents:

- `booking-actions.api.ts` — the ONLY data boundary. The rescue endpoints are REAL (backend `internal/rescue`, all eleven operations): with `VITE_USE_MOCKS=false` every read is sdk call → pure mapper → feature types, and every mutation sends the `Idempotency-Key` header plus the CAS `version` the operator read. The assign COMMIT is still the phase-0 `assignBooking` op (`technician_id` body, no version in its receipt — the mapper echoes the read version, bumped once). The mock branch is untouched.
- `booking-actions.api.map.ts` (responses → feature types, field-by-field so drift is a compile error) · `booking-actions.api.requests.ts` (inputs → generated request bodies; the idempotency key never rides in a body) · `booking-actions.api.errors.ts` (the DECLARED failure bodies → `ApiError`: 409 VERSION_CONFLICT and TOO_EARLY → `conflict`, 422 EVIDENCE_INSUFFICIENT/EXCEEDS_CAP → `validation` with the cap's field error renamed onto the rupee form field, 429 RATE_LIMITED → `rate_limited`; the structured extras — `currentVersion`, `availableAt`, `missing[]`, `resetAt` — have no slot on `ApiError`, so screens re-read their context, which stays authoritative).
- `booking-actions.mock.ts` (reads) · `booking-actions.writes.mock.ts` (mutations + the server-enforced failures) · `booking-actions.fixtures.ts` (the artifacts' data).
- `booking-actions.types.ts` (read contexts) + `booking-actions.inputs.ts` (mutation payloads, re-exported from it) — the normative shapes. `docs/admin-api-contract.md` defers to them.
- `booking-actions.constants.ts` — query keys and the four reason-code vocabularies, as `as const` objects with derived union types.
- `booking-actions.money.ts` — the one rupee ⇄ paise conversion, at the form boundary only.
- `use<Action>.ts` — one hook per action, shared by both shells (the anti-drift rule, spec §2.1).
- `<Action>.desktop.tsx` / `<Action>.mobile.tsx` — chrome only. The form bodies (`CancelBookingForm`, `RedispatchForm` + `RedispatchRadiusField`, `RefundForm`, `ManualCompletion*Step`) are shared.
- `AssignConfirmBody` — the assign confirm step's substance (pairing, ETA, notifications, on-job warning), wrapped by `AssignConfirmSheet` on mobile and `AssignConfirmDialog` on desktop so the two confirms cannot drift.
- `DiscardChangesPrompt` · `ReasonCodeField` · `MobileActionScreen` · `BookingContextStrip` — the pieces every flow reuses (`StepUpChallenge` lives in `components/ui`).

## Business logic — the rules that are not negotiable

1. **The policy is read, never restated.** Risk, step-up, reason-code requirement and undo window all come from `lib/permissions/actions.ts` via `useActionPolicy`, `useStepUp` and `useUndoableAction`. No file here contains "10 seconds" or "requires biometric".
2. **Refund and manual completion have no undo on purpose.** A refund initiates an external gateway call; a manual completion notifies the customer and releases payout eligibility. `useUndoableAction` renders a plain confirmation for both. Do not add an undo affordance to either — they are corrected by a compensating, itself-audited action.
3. **Step-up is fresh verification, not a confirm dialog.** `useStepUp` owns the 60-second window. `StepUpChallenge` only collects the proof, and it collects a **passcode**: no Capacitor biometric plugin is installed, and the native integration point is marked with a comment in that file. Do not add the dependency to satisfy the button label.
4. **Duplicate submission spends real money.** `useAppForm`'s in-flight guard covers the double-click; `useIdempotencyKey` covers everything else. Every mutation payload carries `idempotencyKey`, sent as the `Idempotency-Key` header. The backend must honour it (contract §Idempotency).
5. **The evidence gates, the 30-minute lock, the goodwill cap and the refund rate limit are SERVER-enforced.** `manualCompletionGates.ts` and `refundLimits.ts` mirror them so a screen can explain itself before a round trip. They never decide; the mock and the backend both reject anything that slips past.
6. **Reason codes travel as codes.** Labels are i18n; the audit log and the safety-review router key off the code. The generated client now carries the backend enums (`CancelReasonCode`, `ManualCompletionReasonCode`, `RefundReasonCode`, `RefundType`, `RedispatchRadius`, `RefundPayoutImpact`) and they match the local `as const` vocabularies literal-for-literal — the compiler proves it at the request builders. Mirroring into `@sethu/domain` and deleting the local copies is still owed (docs/admin-api-contract.md).
7. **There is no reschedule flow anywhere**, assign is reachable only from an escalation, and re-dispatch re-runs the automation rather than browsing candidates (`docs/Booking-Workflow-Decisions.md` D1/D3, §7). "Customer requested" is not a cancellation reason: after 60 seconds a customer request is a support ticket.
8. **Back in a dirty flow prompts.** `useDiscardGuard` + `DiscardChangesPrompt`, on every multi-field flow. It stays silent on an untouched form, because a prompt people learn to click through is worse than none (spec §3.3).
9. **Assign never commits on one click, on either shell.** A row's Assign selects; the commit happens on the shared confirm step (`AssignConfirmBody`) that restates the pairing and the on-job warning. Desktop composing it as a dialog is chrome, not a different flow.
10. **Spending is opt-in on re-dispatch.** Priority boost defaults off and the incentive to ₹0; the "Apply recommended" chip applies `defaultIncentivePaise` + boost in one tap, and a non-zero cost is carried on the commit button ("Search again · ₹150"). The pre-selected radius is the context's `defaultRadiusId` — one step beyond the last failed round, never a radius that already failed.
11. **The refund payout impact starts unset.** Choosing a reason applies the recommended impact (`PROVIDER_AT_FAULT_REASONS`), still editable. On desktop the payout radio lives in the form column; the summary rail is read-only.
12. **Labels tell the truth about the step-up.** Every commit and challenge button says "Confirm" (`adminShell actions.confirm`) — "Confirm with biometrics" is banned until a biometric plugin actually exists (see rule 3). The cancel flow's dismiss reads "Keep booking", never "Cancel" under the title "Cancel booking".

## Real mode — what the live backend actually sends

With `VITE_USE_MOCKS=false` the seeded dev data is honest rather than staged: `declinedCount`, round `contacted`/`declined` and `callAttempts` are genuinely 0/empty (the evidence gate keys off SUBMITTED `callAttemptIds`, so the log-a-call flow still works), candidate `distanceKm`/`etaMinutes` are 0 without location data, `providerPayoutPaise` is 0, `isBlockedOffline` is false, and `paymentMethodLabel` is `""` until the booking is paid. `defaultPayoutImpact` is always `pay_anyway` (salaried providers — nothing to withhold); the reason-based recommendation still applies on top. A refund NEVER answers pending (no gateway rail): `isPending` false, `estimatedCompletionIso` null — the pending toast cannot trigger. Undo windows are enforced by the server from the real event timestamps (30s assign / 10s cancel); losing that race rejects, and the hooks surface it as the danger toast. `CancelUndoReceipt.refundReversed` has no slot on `ActionReceipt` yet, so a failed reversal only reaches the operator through the undo-failure toast.

## Mock triggers — how to reach every designed state

`VITE_MOCK_MODE=error|empty|slow` drives loading, error and empty (mock mode only). Everything else is selected by the booking id in the URL (`/bookings/<id>/<action>`):

| Booking id | Action                   | State reached                                                                            |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `B-8823`   | assign                   | Four ranked candidates: best match, plain, on-job (busy warning), previous decliner      |
| `B-8823`   | redispatch               | Three cycles failed — red strip, primary button demoted to outline                       |
| `B-8823`   | cancel / manual-complete | The ordinary path, all evidence satisfied                                                |
| `B-8811`   | assign                   | No candidates — widen radius / re-dispatch / cancel-and-refund                           |
| `B-8813`   | assign                   | Blocked offline (also reachable by taking the browser offline)                           |
| `B-8805`   | cancel                   | Technician on site — amber strip with "Escalate instead"                                 |
| `B-8809`   | manual-complete          | Evidence missing — 0 call attempts, Continue blocked, "Call customer" in the red card    |
| `B-8801`   | manual-complete          | Completion OTP arrived mid-flow — interrupt modal, no "Continue anyway"                  |
| `B-8815`   | manual-complete          | Too early — the 30-minute lock, "available in 18 min"                                    |
| `B-8790`   | refund                   | The ordinary path; picking Goodwill credit above ₹500 shows the cap error                |
| `B-8788`   | refund                   | Gateway goes quiet — the receipt returns `isPending`, the toast says pending, never done |
| `B-8787`   | refund                   | Rate limited — the form is replaced, not disabled                                        |

Submitting manual completion with no logged call attempt returns `422`; submitting on `B-8815` returns `409 TOO_EARLY`; a goodwill refund above the cap returns `422` with a field error on the amount.

Dependencies: `../../components/{ui,states}`, `../../layouts/MobileAppBar`, `../../lib/{env,forms,format,http,permissions,toast}`, `../../hooks/{useStepUp,useUndoableAction,useBreakpoint}`, `../../routes/routes.constants`, `@sethu/{api-client,domain,i18n}`, `@tanstack/react-query`, `react-hook-form`, `zod`.

Boundaries: no sibling feature is imported. Pages are thin — they pick the shell variant and pass the hook's state. Only `components/ui/*` and `layouts/*` may use `styles/components.css` class names, so everything here is token-backed Tailwind utilities plus primitives.

Impacted modules: `pages/{AssignProvider,CancelBooking,Redispatch,ManualCompletion,Refund}Page.tsx`, `packages/i18n/locales/*/features/admin-booking-actions.json` (namespace `adminBookingActions`), and `docs/admin-api-contract.md` (six endpoints).
