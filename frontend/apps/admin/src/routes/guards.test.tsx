import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useSession } from "@sethu/core";
import { afterEach, describe, expect, it } from "vitest";

import { setViewport } from "../../vitest.setup";
import { ADMIN_ACTIONS } from "../lib/permissions/actions";
import { RequireAuth } from "./RequireAuth";
import { RequirePermission } from "./RequirePermission";
import { SurfaceGuard } from "./SurfaceGuard";
import { ROUTES } from "./routes.constants";

// Guard order is auth → permission → surface. Each one has exactly one job, and each one's failure
// mode is a screen an operator cannot get out of: a redirect that forgets where they were going, a
// screen whose every action will be refused, or a blank page on a phone.

afterEach(() => {
  useSession.setState({ user: null, token: null, status: "unauthenticated" });
});

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: { pathname: string } } | null;
  return <p>{`Sign in, wanted ${state?.from?.pathname ?? "nothing"}`}</p>;
}

describe("RequireAuth", () => {
  function renderGuard(at: string = ROUTES.liveAttention) {
    return render(
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path={ROUTES.liveAttention} element={<p>Needs attention queue</p>} />
            <Route path="/bookings/:bookingId" element={<p>Booking record</p>} />
          </Route>
          <Route path={ROUTES.login} element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("waits rather than deciding while the session is still hydrating", () => {
    useSession.setState({ status: "loading" });

    renderGuard();

    // Redirecting here would bounce a signed-in operator to login on every cold start.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Needs attention queue")).not.toBeInTheDocument();
  });

  it("sends an unauthenticated operator to login", () => {
    useSession.setState({ status: "unauthenticated" });

    renderGuard();

    expect(screen.getByText(/Sign in/)).toBeInTheDocument();
  });

  it("carries the attempted destination, so signing in resumes the push notification's booking", () => {
    useSession.setState({ status: "unauthenticated" });

    renderGuard(ROUTES.bookingDetail("B-8823"));

    // Landing on the dashboard after sign-in discards the exact reason they opened the app.
    expect(screen.getByText("Sign in, wanted /bookings/B-8823")).toBeInTheDocument();
  });

  it("lets an authenticated operator straight through", () => {
    useSession.setState({
      status: "authenticated",
      token: "t",
      user: { role: "ADMIN", name: "Ravi Kumar" },
    });

    renderGuard();

    expect(screen.getByText("Needs attention queue")).toBeInTheDocument();
  });
});

describe("RequirePermission", () => {
  function renderGuard() {
    return render(
      <MemoryRouter initialEntries={[ROUTES.bookingRefund("B-8823")]}>
        <Routes>
          <Route
            element={<RequirePermission action={ADMIN_ACTIONS.refund} description="Refunds" />}
          >
            <Route path="/bookings/:bookingId/refund" element={<p>Refund form</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("admits an admin, the single full-access role v1 ships with", () => {
    useSession.setState({
      status: "authenticated",
      user: { role: "ADMIN", name: "Ravi Kumar" },
    });

    renderGuard();

    expect(screen.getByText("Refund form")).toBeInTheDocument();
  });

  it("refuses a non-admin instead of routing them into a screen whose actions all fail", () => {
    useSession.setState({
      status: "authenticated",
      user: { role: "TECHNICIAN", name: "Suresh Mehta" },
    });

    renderGuard();

    expect(screen.getByText("You don't have permission for this")).toBeInTheDocument();
    expect(screen.queryByText("Refund form")).not.toBeInTheDocument();
  });

  it("names what was refused, so the operator knows what access to ask for", () => {
    useSession.setState({
      status: "authenticated",
      user: { role: "ADMIN", name: "Ravi", permissions: [ADMIN_ACTIONS.viewRecord] },
    });

    renderGuard();

    expect(screen.getByText(/^Refunds — /)).toBeInTheDocument();
  });

  it("refuses when there is no session at all", () => {
    useSession.setState({ status: "unauthenticated", user: null });

    renderGuard();

    expect(screen.getByText("You don't have permission for this")).toBeInTheDocument();
  });
});

describe("SurfaceGuard", () => {
  function renderGuard(summary?: React.ReactNode) {
    return render(
      <MemoryRouter initialEntries={[ROUTES.payouts]}>
        <Routes>
          <Route
            element={
              <SurfaceGuard destinationLabelKey="nav.payouts" {...(summary ? { summary } : {})} />
            }
          >
            <Route path={ROUTES.payouts} element={<p>Payout cycles</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders the desktop-only screen on a desktop viewport", () => {
    setViewport(1440);

    renderGuard();

    expect(screen.getByText("Payout cycles")).toBeInTheDocument();
  });

  it("explains itself on a phone instead of producing a blank screen or a 404", () => {
    setViewport(390);

    renderGuard();

    // A deep link from a phone is a scope decision made visible, not a bug.
    expect(screen.getByText("Best on desktop")).toBeInTheDocument();
    expect(screen.queryByText("Payout cycles")).not.toBeInTheDocument();
  });

  it("names the destination, so the notice says what lives here rather than 'this page'", () => {
    setViewport(390);

    renderGuard();

    expect(screen.getByText(/^Payouts & settlements — /)).toBeInTheDocument();
  });

  it("offers a way back, so the phone is never a dead end", () => {
    setViewport(390);

    renderGuard();

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("shows the read-only summary a route can offer above the notice", () => {
    setViewport(390);

    renderGuard(<p>Next cycle closes 25/07</p>);

    expect(screen.getByText("Next cycle closes 25/07")).toBeInTheDocument();
  });
});
