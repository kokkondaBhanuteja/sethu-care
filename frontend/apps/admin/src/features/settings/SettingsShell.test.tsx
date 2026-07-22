import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { SHELL_QUERY_KEYS } from "../../queries/useShellCounters";
import type { ShellCounters } from "../../queries/shell.types";
import { SettingsShell } from "./SettingsShell";
import { SETTINGS_SECTION_IDS, SETTINGS_SECTIONS } from "./settings.constants";

// The unified desktop Settings frame: one visible h1 ("Settings"), a sub-nav that lists every
// section and announces the active one, and the section's own name as the content's h2. If any of
// these drift, the "which of these four places holds the thing I want?" confusion comes back.

const NO_COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

function renderShell(initialPath: string, ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(SHELL_QUERY_KEYS.counters, NO_COUNTERS);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

describe("the frame", () => {
  it("renders exactly one h1, and it says Settings", () => {
    renderShell(
      "/settings/security",
      <SettingsShell section={SETTINGS_SECTION_IDS.security}>content</SettingsShell>,
    );

    const pageHeadings = screen.getAllByRole("heading", { level: 1 });
    expect(pageHeadings).toHaveLength(1);
    expect(pageHeadings[0]).toHaveTextContent("Settings");
  });

  it("leads the content with the active section's name and one-line description", () => {
    renderShell(
      "/settings/security",
      <SettingsShell section={SETTINGS_SECTION_IDS.security}>content</SettingsShell>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Security & devices" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/How this account unlocks/)).toBeInTheDocument();
  });
});

describe("the sub-nav", () => {
  it("is a labelled navigation landmark listing every section", () => {
    renderShell(
      "/settings/notifications",
      <SettingsShell section={SETTINGS_SECTION_IDS.notifications}>content</SettingsShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(nav).toBeInTheDocument();
    for (const label of ["Profile", "Notifications", "Security & devices", "Help & about"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the section matching the URL as the current page, and only it", () => {
    renderShell(
      "/settings/notifications",
      <SettingsShell section={SETTINGS_SECTION_IDS.notifications}>content</SettingsShell>,
    );

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current");
  });

  it("links every section at the URL the route table owns for it", () => {
    renderShell(
      "/profile",
      <SettingsShell section={SETTINGS_SECTION_IDS.profile}>content</SettingsShell>,
    );

    for (const section of SETTINGS_SECTIONS) {
      const links = screen.getAllByRole("link");
      expect(links.map((link) => link.getAttribute("href"))).toContain(section.to);
    }
  });
});
