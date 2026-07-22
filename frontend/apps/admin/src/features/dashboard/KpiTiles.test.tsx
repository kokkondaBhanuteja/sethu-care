import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EMPTY_SUMMARY, SUMMARY } from "./dashboard.fixtures";
import { KpiTiles } from "./KpiTiles";

// The KPI strip is the redesigned ui-web tile: vivid solid icon chip, muted caption, text-kpi
// number, semantic trend line. The trend is the one place in the console where up is not reliably
// good — a rising assignment time is bad news and its up-arrow is red — so the direction AND
// whether the movement is good both have to be words a screen reader can hear.

describe("KpiTiles", () => {
  it("renders the four figures with their labels", () => {
    render(<KpiTiles summary={SUMMARY} />);

    expect(screen.getByText("Bookings")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Completion")).toBeInTheDocument();
    expect(screen.getByText("Avg time to assign")).toBeInTheDocument();
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("anchors each tile with its vivid accent chip — blue, green, purple, amber", () => {
    const { container } = render(<KpiTiles summary={SUMMARY} />);

    for (const accentClass of [
      ".bg-accent-blue",
      ".bg-accent-green",
      ".bg-accent-purple",
      ".bg-accent-amber",
    ]) {
      expect(container.querySelector(accentClass)).not.toBeNull();
    }
  });

  it("says the trend direction and tone in words, since the glyph announces as a triangle", () => {
    render(<KpiTiles summary={SUMMARY} />);

    // Rising bookings are good news; rising assignment time is bad news at the same arrow.
    expect(screen.getByText("up 12%, better")).toBeInTheDocument();
    expect(screen.getByText("up 40s, worse")).toBeInTheDocument();
    expect(screen.getByText("down 2%, worse")).toBeInTheDocument();
  });

  it("colours the trend by whether the news is good, never by which way the arrow points", () => {
    const { container } = render(<KpiTiles summary={SUMMARY} />);

    // Completion fell and assignment time rose — two bad movements, two danger-toned lines.
    expect(container.querySelectorAll(".text-danger-fg")).toHaveLength(2);
    expect(container.querySelectorAll(".text-success-fg")).toHaveLength(2);
  });

  it("shows a dash instead of zeros when nothing has been booked today", () => {
    render(<KpiTiles summary={EMPTY_SUMMARY} />);

    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText(/better|worse/)).not.toBeInTheDocument();
  });

  it("lays the strip out as the responsive two-up / four-up grid", () => {
    render(<KpiTiles summary={SUMMARY} />);

    const strip = screen.getByRole("group", { name: "Key figures" });
    expect(strip.className).toContain("grid-cols-2");
    expect(strip.className).toContain("lg:grid-cols-4");
  });
});
