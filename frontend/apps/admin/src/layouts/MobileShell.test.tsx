import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { ROUTE_PATTERNS, ROUTES } from "../routes/routes.constants";
import { SHELL_QUERY_KEYS } from "../queries/useShellCounters";
import type { ShellCounters } from "../queries/shell.types";
import { MobileShell } from "./MobileShell";

// The tab bar disappearing on a full-screen task is a safety property, not a stylistic one: a
// visible tab bar mid-cancellation is a one-tap exit from a half-filled irreversible form that
// bypasses the "Discard changes?" guard entirely (spec §3.3).

const COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

function renderAt(pathname: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(SHELL_QUERY_KEYS.counters, COUNTERS);

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<MobileShell />}>
          <Route path={ROUTES.live} element={<p>Live dashboard</p>} />
          <Route path={ROUTES.bookings} element={<p>Bookings list</p>} />
          <Route path={ROUTE_PATTERNS.bookingDetail} element={<p>Booking record</p>} />
          <Route path={ROUTE_PATTERNS.bookingCancel} element={<p>Cancel booking</p>} />
          <Route path={ROUTE_PATTERNS.bookingRefund} element={<p>Issue refund</p>} />
          <Route path={ROUTE_PATTERNS.bookingManualComplete} element={<p>Manual completion</p>} />
          <Route path={ROUTE_PATTERNS.providerSuspend} element={<p>Suspend provider</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
}

function tabBar() {
  return screen.queryByRole("navigation", { name: "Primary" });
}

describe("on a tab root", () => {
  it("shows the tab bar on the dashboard", () => {
    renderAt(ROUTES.live);

    expect(screen.getByText("Live dashboard")).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
  });

  it("shows the tab bar on the bookings list", () => {
    renderAt(ROUTES.bookings);

    expect(tabBar()).toBeInTheDocument();
  });

  it("shows the tab bar on a booking record, which is a destination and not a task", () => {
    renderAt(ROUTES.bookingDetail("B-8823"));

    expect(screen.getByText("Booking record")).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
  });
});

describe("on a full-screen task", () => {
  it("hides the tab bar mid-cancellation", () => {
    renderAt(ROUTES.bookingCancel("B-8823"));

    expect(screen.getByText("Cancel booking")).toBeInTheDocument();
    // Asserted as an absence: this is the one-tap escape from a half-filled irreversible form.
    expect(tabBar()).not.toBeInTheDocument();
  });

  it.each([
    ["a refund", ROUTES.bookingRefund("B-8823"), "Issue refund"],
    ["a manual completion", ROUTES.bookingManualComplete("B-8823"), "Manual completion"],
    ["a provider suspension", ROUTES.providerSuspend("P-104"), "Suspend provider"],
  ])("hides the tab bar during %s too", (_name, pathname, content) => {
    renderAt(pathname);

    expect(screen.getByText(content)).toBeInTheDocument();
    expect(tabBar()).not.toBeInTheDocument();
  });

  it("still renders the task itself, so hiding the chrome never hides the work", () => {
    renderAt(ROUTES.bookingCancel("B-8823"));

    expect(screen.getByText("Cancel booking")).toBeInTheDocument();
  });
});
