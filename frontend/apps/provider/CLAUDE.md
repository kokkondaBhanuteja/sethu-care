# apps/provider

Scope: The provider (technician) SPA — mobile-first Capacitor app. Nothing customer/admin-specific belongs here.
Purpose: Availability + live location, receive direct auto-assigned jobs (no accept/decline; ESCALATE is the relief valve), drive the job lifecycle (DEPART→ARRIVE→OTP start→photos→OTP complete), collect payment, settle cash. Flows: docs/workflows/provider-workflow.md.
Contents: src/main.tsx (boot wiring), src/App.tsx (shell — tabs Jobs/Earnings/Account), src/index.css (@theme + safe areas), capacitor.config.ts (in.sethucare.provider), ios/ android/ (committed).
Business logic: none yet — runnable shell only.
Dependencies: @sethu/{api-client,core,domain,i18n,tokens}, react-router, @tanstack/react-query, zustand, @capacitor/*.
Boundaries: never import other apps; no raw fetch; no hardcoded text/visual values; work-photo/camera/location integrations go through Capacitor plugins wired in src/lib/, not inline.
Impacted modules: both provider store apps ship from this tree.
