// English namespace bundle — the canonical source the type-safe keys are generated from.
// One module per locale keeps config.ts readable now that the admin console contributes a
// namespace per feature folder. Add a namespace here, in hi.ts and in te.ts together.

import common from "../../locales/en/common.json";
import auth from "../../locales/en/features/auth.json";
import booking from "../../locales/en/features/booking.json";
import jobs from "../../locales/en/features/jobs.json";
import adminShell from "../../locales/en/features/admin-shell.json";
import adminAuth from "../../locales/en/features/admin-auth.json";
import adminDashboard from "../../locales/en/features/admin-dashboard.json";
import adminBookings from "../../locales/en/features/admin-bookings.json";
import adminBookingActions from "../../locales/en/features/admin-booking-actions.json";
import adminProviders from "../../locales/en/features/admin-providers.json";
import adminAlerts from "../../locales/en/features/admin-alerts.json";
import adminMap from "../../locales/en/features/admin-map.json";
import adminAudit from "../../locales/en/features/admin-audit.json";
import adminSettings from "../../locales/en/features/admin-settings.json";

export const en = {
  common,
  auth,
  booking,
  jobs,
  adminShell,
  adminAuth,
  adminDashboard,
  adminBookings,
  adminBookingActions,
  adminProviders,
  adminAlerts,
  adminMap,
  adminAudit,
  adminSettings,
} as const;
