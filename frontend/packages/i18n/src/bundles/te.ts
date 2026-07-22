// TE namespace bundle. Mirrors en.ts exactly — pnpm i18n:check fails CI if the key
// sets diverge. Admin-console values are currently English placeholders pending translation.

import common from "../../locales/te/common.json";
import auth from "../../locales/te/features/auth.json";
import booking from "../../locales/te/features/booking.json";
import jobs from "../../locales/te/features/jobs.json";
import adminShell from "../../locales/te/features/admin-shell.json";
import adminAuth from "../../locales/te/features/admin-auth.json";
import adminDashboard from "../../locales/te/features/admin-dashboard.json";
import adminBookings from "../../locales/te/features/admin-bookings.json";
import adminBookingActions from "../../locales/te/features/admin-booking-actions.json";
import adminProviders from "../../locales/te/features/admin-providers.json";
import adminAlerts from "../../locales/te/features/admin-alerts.json";
import adminMap from "../../locales/te/features/admin-map.json";
import adminAudit from "../../locales/te/features/admin-audit.json";
import adminSettings from "../../locales/te/features/admin-settings.json";

export const te = {
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
