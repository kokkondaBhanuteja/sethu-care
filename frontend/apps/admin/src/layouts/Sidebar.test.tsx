import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useSession } from "@sethu/core";
import { afterEach, describe, expect, it } from "vitest";

import { SHELL_QUERY_KEYS } from "../queries/useShellCounters";
import type { ShellCounters } from "../queries/shell.types";
import { Sidebar } from "./Sidebar";

// Desktop has no tab bar and no More menu, so every destination in the product has to be reachable
// from this one 240px rail. A group silently dropping out of it strands a whole area of the console
// with no route to it at all.

const NO_COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

function renderSidebar(counters: ShellCounters = NO_COUNTERS) {
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

  return render(<Sidebar />, { wrapper: Wrapper });
}

afterEach(() => {
  useSession.setState({ user: null, token: null, status: "unauthenticated" });
});

describe("the five groups", () => {
  it("renders all five, in the order the navigation artboard sets", () => {
    const { container } = renderSidebar();

    const headers = Array.from(container.querySelectorAll(".sidebar__group-header"));
    expect(headers.map((header) => header.textContent)).toEqual([
      "Live",
      "Manage",
      "Records",
      "Desktop only",
      "Account",
    ]);
  });

  it("names the rail, so it is announced as the primary navigation", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("reaches everything mobile hides behind More and the tab bar", () => {
    renderSidebar();

    for (const destination of [
      "Needs attention",
      "Map",
      "Customers",
      "Support tickets",
      "Analytics",
      "Audit log",
      "Payouts & settlements",
      "Reports & exports",
      "Platform settings",
      "Notifications",
      "Security & devices",
      "Help & support",
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(destination) })).toBeInTheDocument();
    }
  });

  it("marks the item matching the current route active", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Live" })).toHaveClass("is-active");
    expect(screen.getByRole("link", { name: "Map" })).not.toHaveClass("is-active");
  });
});

describe("badges", () => {
  it("shows no badge on a counter that is at zero", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
  });

  it("badges only the item its counter belongs to", () => {
    renderSidebar({ ...NO_COUNTERS, criticalAlerts: 2 });

    expect(screen.getByRole("link", { name: /2 Alerts/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Needs attention" })).toBeInTheDocument();
  });

  it("announces the count, not just the destination it sits on", () => {
    // A badge whose accessible name is only the destination repeats the link's own label and leaves
    // the number — the only new information — to sighted operators alone.
    renderSidebar({ ...NO_COUNTERS, needsAttention: 7, openTickets: 4 });

    expect(screen.getByRole("link", { name: /7 Needs attention/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /4 Support tickets/ })).toBeInTheDocument();
  });

  it("keeps the digit itself out of the announcement, so the count is read once", () => {
    renderSidebar({ ...NO_COUNTERS, criticalAlerts: 2 });

    expect(screen.getByText("2")).toHaveAttribute("aria-hidden");
  });
});

describe("the account row", () => {
  it("stays out of the rail entirely when nobody is signed in", () => {
    renderSidebar();

    expect(screen.queryByText("Manage")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the signed-in operator, because desktop has no More tab to hold sign-out", () => {
    useSession.setState({ user: { role: "ADMIN", name: "Ravi Kumar" }, status: "authenticated" });

    renderSidebar();

    expect(screen.getByRole("button", { name: /Ravi Kumar/ })).toBeInTheDocument();
  });
});
