# apps/customer

Scope: The customer-facing SPA — web (customer website) and the Capacitor iOS/Android customer app from one responsive codebase. Nothing admin/provider-specific belongs here.
Purpose: Book on-demand home services, track the job live, verify via dual OTP, pay, review. Flows: docs/workflows/customer-workflow.md (60s cancel window; history = Booked + Completed only).
Contents: src/main.tsx (boot wiring: api client, i18n, providers), src/App.tsx (shell + routes — placeholder tabs Home/Bookings/Offers/Profile), src/index.css (@theme tokens + safe areas), capacitor.config.ts (in.sethucare.customer), ios/ android/ (committed Capacitor projects).
Business logic: none yet — runnable shell only; features land under src/features/ per ENGINEERING-STANDARDS.md Part 1.
Dependencies: @sethu/{api-client,core,domain,i18n,tokens}, react-router, @tanstack/react-query, zustand, @capacitor/*.
Boundaries: never import from apps/provider|admin|landing; no raw fetch (generated client only); no hardcoded text/visual values; server state only in TanStack Query.
Impacted modules: the customer web deploy and both customer store apps ship from this tree.
