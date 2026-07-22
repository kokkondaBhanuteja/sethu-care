import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { RouteErrorBoundary } from "../components/ErrorBoundary";
import { DesktopOnlySummary } from "../features/settings/DesktopOnlySummary";
import { DESKTOP_SURFACES } from "../features/settings/settings.constants";
import { Spinner } from "../components/ui/Spinner";
import { AdminShell } from "../layouts/AdminShell";
import { ADMIN_ACTIONS } from "../lib/permissions/actions";
import { RequireAuth } from "./RequireAuth";
import { RequirePermission } from "./RequirePermission";
import { SurfaceGuard } from "./SurfaceGuard";
import { DEFAULT_ROUTE, ROUTES, ROUTE_PATTERNS } from "./routes.constants";

// Route-level code splitting keeps the cold-start path small: the spec budgets <2s to interactive
// on a mid-range Android, and the audit log's table has no business being in the login bundle.
const SplashPage = lazy(() => import("../pages/SplashPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const OtpPage = lazy(() => import("../pages/OtpPage"));
const UnlockPage = lazy(() => import("../pages/UnlockPage"));

const LiveDashboardPage = lazy(() => import("../pages/LiveDashboardPage"));
const NeedsAttentionPage = lazy(() => import("../pages/NeedsAttentionPage"));
const LiveMapPage = lazy(() => import("../pages/LiveMapPage"));

const BookingsListPage = lazy(() => import("../pages/BookingsListPage"));
const BookingDetailPage = lazy(() => import("../pages/BookingDetailPage"));
const AssignProviderPage = lazy(() => import("../pages/AssignProviderPage"));
const CancelBookingPage = lazy(() => import("../pages/CancelBookingPage"));
const RedispatchPage = lazy(() => import("../pages/RedispatchPage"));
const ManualCompletionPage = lazy(() => import("../pages/ManualCompletionPage"));
const RefundPage = lazy(() => import("../pages/RefundPage"));

const ProviderRosterPage = lazy(() => import("../pages/ProviderRosterPage"));
const ProviderProfilePage = lazy(() => import("../pages/ProviderProfilePage"));
const SuspendProviderPage = lazy(() => import("../pages/SuspendProviderPage"));
const ApplicationsQueuePage = lazy(() => import("../pages/ApplicationsQueuePage"));
const ApplicationReviewPage = lazy(() => import("../pages/ApplicationReviewPage"));

const AlertsFeedPage = lazy(() => import("../pages/AlertsFeedPage"));
const AlertDetailPage = lazy(() => import("../pages/AlertDetailPage"));

const MoreMenuPage = lazy(() => import("../pages/MoreMenuPage"));
const AuditLogPage = lazy(() => import("../pages/AuditLogPage"));
const NotificationSettingsPage = lazy(() => import("../pages/NotificationSettingsPage"));
const SecuritySettingsPage = lazy(() => import("../pages/SecuritySettingsPage"));
const AdminProfilePage = lazy(() => import("../pages/AdminProfilePage"));
const HelpSupportPage = lazy(() => import("../pages/HelpSupportPage"));

const CustomerLookupPage = lazy(() => import("../pages/CustomerLookupPage"));
const CustomerProfilePage = lazy(() => import("../pages/CustomerProfilePage"));
const TicketsPage = lazy(() => import("../pages/TicketsPage"));
const TicketDetailPage = lazy(() => import("../pages/TicketDetailPage"));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage"));

const PayoutsPage = lazy(() => import("../pages/PayoutsPage"));
const ServicesPage = lazy(() => import("../pages/ServicesPage"));
const PricingPage = lazy(() => import("../pages/PricingPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const PlatformSettingsPage = lazy(() => import("../pages/PlatformSettingsPage"));

function RouteFallback() {
  return (
    <div className="empty empty--grow">
      <Spinner />
    </div>
  );
}

/**
 * The route table from spec §3.2, as amended by docs/Booking-Workflow-Decisions.md — there is no
 * reschedule route, because rescheduling was removed from the product (D1).
 *
 * Paths come from routes.constants.ts; none is written inline here.
 */
export function AppRoutes() {
  return (
    <RouteErrorBoundary boundaryName="app">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={ROUTES.splash} element={<SplashPage />} />
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.loginOtp} element={<OtpPage />} />
          <Route path={ROUTES.unlock} element={<UnlockPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AdminShell />}>
              <Route index element={<Navigate to={DEFAULT_ROUTE} replace />} />

              <Route path={ROUTES.live} element={<LiveDashboardPage />} />
              <Route path={ROUTES.liveAttention} element={<NeedsAttentionPage />} />
              <Route path={ROUTES.liveMap} element={<LiveMapPage />} />

              <Route path={ROUTES.bookings} element={<BookingsListPage />} />
              <Route path={ROUTE_PATTERNS.bookingDetail} element={<BookingDetailPage />} />
              <Route element={<RequirePermission action={ADMIN_ACTIONS.assignProvider} />}>
                <Route path={ROUTE_PATTERNS.bookingAssign} element={<AssignProviderPage />} />
              </Route>
              <Route element={<RequirePermission action={ADMIN_ACTIONS.cancelBooking} />}>
                <Route path={ROUTE_PATTERNS.bookingCancel} element={<CancelBookingPage />} />
              </Route>
              <Route element={<RequirePermission action={ADMIN_ACTIONS.redispatch} />}>
                <Route path={ROUTE_PATTERNS.bookingRedispatch} element={<RedispatchPage />} />
              </Route>
              <Route element={<RequirePermission action={ADMIN_ACTIONS.manualComplete} />}>
                <Route
                  path={ROUTE_PATTERNS.bookingManualComplete}
                  element={<ManualCompletionPage />}
                />
              </Route>
              <Route element={<RequirePermission action={ADMIN_ACTIONS.refund} />}>
                <Route path={ROUTE_PATTERNS.bookingRefund} element={<RefundPage />} />
              </Route>

              <Route path={ROUTES.providers} element={<ProviderRosterPage />} />
              <Route path={ROUTES.applications} element={<ApplicationsQueuePage />} />
              <Route path={ROUTE_PATTERNS.applicationReview} element={<ApplicationReviewPage />} />
              <Route path={ROUTE_PATTERNS.providerDetail} element={<ProviderProfilePage />} />
              <Route element={<RequirePermission action={ADMIN_ACTIONS.suspendProvider} />}>
                <Route path={ROUTE_PATTERNS.providerSuspend} element={<SuspendProviderPage />} />
              </Route>

              <Route path={ROUTES.alerts} element={<AlertsFeedPage />} />
              <Route path={ROUTE_PATTERNS.alertDetail} element={<AlertDetailPage />} />

              <Route path={ROUTES.more} element={<MoreMenuPage />} />
              <Route path={ROUTES.audit} element={<AuditLogPage />} />
              <Route path={ROUTES.notificationSettings} element={<NotificationSettingsPage />} />
              <Route path={ROUTES.securitySettings} element={<SecuritySettingsPage />} />
              <Route path={ROUTES.profile} element={<AdminProfilePage />} />
              <Route path={ROUTES.support} element={<HelpSupportPage />} />

              <Route path={ROUTES.customers} element={<CustomerLookupPage />} />
              <Route path={ROUTE_PATTERNS.customerDetail} element={<CustomerProfilePage />} />
              <Route path={ROUTES.tickets} element={<TicketsPage />} />
              <Route path={ROUTE_PATTERNS.ticketDetail} element={<TicketDetailPage />} />
              <Route path={ROUTES.analytics} element={<AnalyticsPage />} />

              <Route
                element={
                  <SurfaceGuard
                    destinationLabelKey="nav.payouts"
                    summary={<DesktopOnlySummary surface={DESKTOP_SURFACES.payouts} />}
                  />
                }
              >
                <Route path={ROUTES.payouts} element={<PayoutsPage />} />
              </Route>
              <Route
                element={
                  <SurfaceGuard
                    destinationLabelKey="nav.services"
                    summary={<DesktopOnlySummary surface={DESKTOP_SURFACES.services} />}
                  />
                }
              >
                <Route path={ROUTES.services} element={<ServicesPage />} />
              </Route>
              <Route
                element={
                  <SurfaceGuard
                    destinationLabelKey="nav.pricing"
                    summary={<DesktopOnlySummary surface={DESKTOP_SURFACES.pricing} />}
                  />
                }
              >
                <Route path={ROUTES.pricing} element={<PricingPage />} />
              </Route>
              <Route
                element={
                  <SurfaceGuard
                    destinationLabelKey="nav.reports"
                    summary={<DesktopOnlySummary surface={DESKTOP_SURFACES.reports} />}
                  />
                }
              >
                <Route path={ROUTES.reports} element={<ReportsPage />} />
              </Route>
              <Route
                element={
                  <SurfaceGuard
                    destinationLabelKey="nav.platformSettings"
                    summary={<DesktopOnlySummary surface={DESKTOP_SURFACES.platform} />}
                  />
                }
              >
                <Route path={ROUTES.platformSettings} element={<PlatformSettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
