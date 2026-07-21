# apps/admin

Scope: The ops console — one responsive codebase serving the admin web dashboard (>=768px DesktopShell) and the Capacitor admin mobile app (MobileShell). Spec: docs/Admin-Mobile-App.md (as amended by docs/Booking-Workflow-Decisions.md — assignment is rescue-only, no reschedule, no Scheduled segment).
Purpose: Monitor live ops; rescue escalations; emergency cancel; admin-verified manual completion; providers/applications; refunds; audit. Flows: docs/workflows/admin-workflow.md.
Contents: src/main.tsx (boot wiring), src/App.tsx (MobileShell tab bar + DesktopShell sidebar frames, route placeholders), src/index.css (@theme + ops density comes later per spec §4), capacitor.config.ts (in.sethucare.admin), ios/ android/ (committed).
Business logic: none yet — shells only. Route table will carry the spec's `surface` flag (desktopOnly guard).
Dependencies: @sethu/{api-client,core,domain,i18n,tokens}, react-router, @tanstack/react-query, zustand, @capacitor/*.
Boundaries: never import other apps; destructive/financial actions follow the spec's step-up + reason-code model when they land; badge = unacknowledged critical only.
Impacted modules: admin web deploy + both admin store apps.
