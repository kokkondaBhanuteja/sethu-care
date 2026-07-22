// HI namespace bundle. Mirrors en.ts exactly — pnpm i18n:check fails CI if the key
// sets diverge. Admin-console values are currently English placeholders pending translation.

import common from "../../locales/hi/common.json";
import auth from "../../locales/hi/features/auth.json";
import booking from "../../locales/hi/features/booking.json";
import jobs from "../../locales/hi/features/jobs.json";
import adminShell from "../../locales/hi/features/admin-shell.json";
import adminAuth from "../../locales/hi/features/admin-auth.json";
import adminDashboard from "../../locales/hi/features/admin-dashboard.json";
import adminBookings from "../../locales/hi/features/admin-bookings.json";
import adminBookingActions from "../../locales/hi/features/admin-booking-actions.json";
import adminProviders from "../../locales/hi/features/admin-providers.json";
import adminAlerts from "../../locales/hi/features/admin-alerts.json";
import adminMap from "../../locales/hi/features/admin-map.json";
import adminAudit from "../../locales/hi/features/admin-audit.json";
import adminSettings from "../../locales/hi/features/admin-settings.json";

export const hi = {
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
