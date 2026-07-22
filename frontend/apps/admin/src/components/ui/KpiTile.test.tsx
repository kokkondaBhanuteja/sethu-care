import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiTile } from "./KpiTile";

// The trend chip is the one place in the console where up is not reliably good: a rising assignment
// time is bad news and its up-arrow is red. A screen reader hears no colour, so the direction AND
// whether the movement is good both have to be words.

describe("KpiTile", () => {
  it("shows the label and the pre-formatted value", () => {
    render(<KpiTile label="Bookings today" value="1,284" />);

    expect(screen.getByText("Bookings today")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  describe("the trend", () => {
    it("says the direction in words, since the glyph announces as a triangle", () => {
      render(
        <KpiTile
          label="Bookings today"
          value="1,284"
          trend={{ delta: "12%", direction: "up", isGood: true }}
        />,
      );

      expect(screen.getByText("up 12%, better")).toBeInTheDocument();
    });

    it("says whether the movement is good, because up is not reliably good here", () => {
      // Rising assignment time is bad news; the chip is red and the words have to agree.
      render(
        <KpiTile
          label="Avg assignment time"
          value="4m 12s"
          trend={{ delta: "40s", direction: "up", isGood: false }}
        />,
      );

      expect(screen.getByText("up 40s, worse")).toBeInTheDocument();
    });

    it("reads a fall as bad when falling is the bad direction", () => {
      render(
        <KpiTile
          label="Completion rate"
          value="94.2%"
          trend={{ delta: "3%", direction: "down", isGood: false }}
        />,
      );

      expect(screen.getByText("down 3%, worse")).toBeInTheDocument();
    });

    it("reads a fall as good when falling is the good direction", () => {
      render(
        <KpiTile
          label="Avg assignment time"
          value="3m 30s"
          trend={{ delta: "40s", direction: "down", isGood: true }}
        />,
      );

      expect(screen.getByText("down 40s, better")).toBeInTheDocument();
    });

    it("hides the arrow glyph from assistive tech so the direction is never read twice", () => {
      render(
        <KpiTile
          label="Bookings today"
          value="1,284"
          trend={{ delta: "12%", direction: "up", isGood: true }}
        />,
      );

      expect(screen.getByText("▲")).toHaveAttribute("aria-hidden");
    });

    it("colours the chip by whether the news is good, not by which way the arrow points", () => {
      const { container } = render(
        <KpiTile
          label="Avg assignment time"
          value="4m 12s"
          trend={{ delta: "40s", direction: "up", isGood: false }}
        />,
      );

      expect(container.querySelector(".trend")).toHaveClass("trend--bad");
    });
  });

  describe("the sparkline", () => {
    it("is decorative, because the trend chip already carries the number in words", () => {
      const { container } = render(
        <KpiTile label="Bookings today" value="1,284" sparkline={[4, 6, 5, 9, 7, 8, 11, 12]} />,
      );

      expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("draws nothing from a single point, which has no shape to describe", () => {
      const { container } = render(
        <KpiTile label="Bookings today" value="1,284" sparkline={[4]} />,
      );

      expect(container.querySelector("svg")).toBeNull();
    });

    it("survives a flat series without dividing by zero", () => {
      const { container } = render(
        <KpiTile label="Bookings today" value="1,284" sparkline={[5, 5, 5, 5]} />,
      );

      expect(container.querySelector("path")?.getAttribute("d")).not.toContain("NaN");
    });
  });

  it("prefers a footnote over the trend row when the caller gives one", () => {
    render(
      <KpiTile
        label="Payout due"
        value="₹2.1L"
        foot="Cycle closes 25/07"
        trend={{ delta: "12%", direction: "up", isGood: true }}
      />,
    );

    expect(screen.getByText("Cycle closes 25/07")).toBeInTheDocument();
    expect(screen.queryByText("up 12%, better")).not.toBeInTheDocument();
  });
});
