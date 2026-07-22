import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { SHELL_QUERY_KEYS } from "../queries/useShellCounters";
import type { ShellCounters } from "../queries/shell.types";
import { TabBar } from "./TabBar";

// Five tabs is the ceiling before targets get too small, and badge discipline (spec §3.1) is the
// other half: red means "a human must act". A badge that counts everything sits permanently non-zero
// and a permanently non-zero badge is invisible.

const NO_COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

function renderTabBar(counters: ShellCounters = NO_COUNTERS) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(SHELL_QUERY_KEYS.counters, counters);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/live"]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(<TabBar />, { wrapper: Wrapper });
}

describe("the five tabs", () => {
  it("offers exactly five destinations", () => {
    renderTabBar();

    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("names them Live, Bookings, Providers, Alerts and More", () => {
    renderTabBar();

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Live",
      "Bookings",
      "Providers",
      "Alerts",
      "More",
    ]);
  });

  it("names the bar itself, so the tabs are announced as the primary navigation", () => {
    renderTabBar();

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("marks the tab matching the current route active", () => {
    renderTabBar();

    expect(screen.getByRole("link", { name: /Live/ })).toHaveClass("is-active");
    expect(screen.getByRole("link", { name: /Bookings/ })).not.toHaveClass("is-active");
  });
});

describe("badges", () => {
  it("shows no badge at zero, so a badge always means something is waiting", () => {
    renderTabBar();

    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the count when there is one, and announces what it counts", () => {
    renderTabBar({ ...NO_COUNTERS, criticalAlerts: 3 });

    expect(screen.getByRole("link", { name: /3 Alerts/ })).toBeInTheDocument();
  });

  it("caps the glyph at 9+ so the badge stays inside the tab", () => {
    renderTabBar({ ...NO_COUNTERS, criticalAlerts: 12 });

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("still announces the true count behind the cap — 12 stranded bookings is not 9", () => {
    renderTabBar({ ...NO_COUNTERS, criticalAlerts: 12 });

    expect(screen.getByText("12 Alerts")).toBeInTheDocument();
  });

  it("shows exactly 9 without the plus", () => {
    renderTabBar({ ...NO_COUNTERS, criticalAlerts: 9 });

    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });

  it("badges only the tabs the counters drive, never Live, Bookings or More", () => {
    renderTabBar({
      criticalAlerts: 2,
      needsAttention: 7,
      pendingApplications: 3,
      openTickets: 4,
    });

    // Needs attention and tickets live behind other tabs on mobile; their counts must not leak onto
    // Live or More, which would make both badges permanently lit.
    expect(screen.getByRole("link", { name: "Live" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2 Alerts/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /3 Providers/ })).toBeInTheDocument();
  });
});
