import { Activity, TriangleAlert } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSectionCard } from "./DashboardSectionCard";

// Both dashboard shells compose their sections from this one card, so the icon-header anatomy —
// soft chip, one h2 under the page's single h1, right-aligned actions — is asserted once here
// rather than re-checked per screen.

describe("DashboardSectionCard", () => {
  it("titles the section with an h2, keeping the page's single h1 in the topbar", () => {
    render(
      <DashboardSectionCard icon={TriangleAlert} accent="amber" title="Needs attention">
        <p>body</p>
      </DashboardSectionCard>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("carries the soft accent chip as the header's only colour", () => {
    const { container } = render(
      <DashboardSectionCard icon={TriangleAlert} accent="amber" title="Needs attention">
        <p>body</p>
      </DashboardSectionCard>,
    );

    expect(container.querySelector(".bg-tint-amber-bg")).not.toBeNull();
  });

  it("renders per-card actions beside the title", () => {
    render(
      <DashboardSectionCard
        icon={Activity}
        accent="brand"
        title="Activity"
        actions={<button type="button">Refresh</button>}
      >
        <p>body</p>
      </DashboardSectionCard>,
    );

    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
