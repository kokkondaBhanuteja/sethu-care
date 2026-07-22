import { render, screen } from "@testing-library/react";
import { TriangleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";
import { DOT_TONES, StatusDot, type DotTone } from "./StatusDot";
import { Pill, PILL_TONES, type PillTone } from "./Pill";

// Spec §4.8: colour never carries meaning alone. This is the rule most likely to be broken by a
// well-meaning simplification — a red dot "obviously" means offline to the person who wrote it — and
// the one whose breakage is invisible to everyone who can see the colour.

const DOT_TONE_NAMES = Object.keys(DOT_TONES) as DotTone[];
const PILL_TONE_NAMES = Object.keys(PILL_TONES) as PillTone[];

describe("StatusDot", () => {
  it.each(DOT_TONE_NAMES)(
    "renders its meaning in words for the %s tone, not just the colour",
    (tone) => {
      render(<StatusDot tone={tone} label="Offline" />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
    },
  );

  it("keeps the label available to assistive tech when it is not drawn beside the dot", () => {
    render(<StatusDot tone="danger" label="Offline" />);

    expect(screen.getByText("Offline")).toHaveClass("sr-only");
  });

  it("draws the label beside the dot when the row has room for it", () => {
    render(<StatusDot tone="success" label="Available" visualLabel />);

    expect(screen.getByText("Available")).not.toHaveClass("sr-only");
  });

  it("suppresses the label only when the caller deliberately says the parent already says it", () => {
    // The prop stays required so choosing this is an act, not an omission — the enclosing row's own
    // accessible name has to contain the status word or the meaning is lost entirely.
    render(
      <button type="button">
        Suresh Mehta — Offline
        <StatusDot tone="danger" label="Offline" labelledByParent />
      </button>,
    );

    expect(screen.getByRole("button", { name: "Suresh Mehta — Offline" })).toBeInTheDocument();
  });

  it("carries fill and pulse as classes, because half and hollow are legend entries too", () => {
    const { container } = render(
      <StatusDot tone="warning" label="Partly available" fill="half" pulse />,
    );

    const dot = container.querySelector(".dot");
    expect(dot).toHaveClass("dot--warning", "dot--half", "dot--pulse");
  });
});

describe("Pill", () => {
  it.each(PILL_TONE_NAMES)("shows its label for the %s tone", (tone) => {
    render(<Pill tone={tone}>Escalated</Pill>);

    expect(screen.getByText("Escalated")).toBeInTheDocument();
  });

  it("keeps the label when an icon is added, rather than letting the glyph stand in for it", () => {
    const { container } = render(
      <Pill tone="danger" icon={TriangleAlert}>
        Escalated
      </Pill>,
    );

    expect(screen.getByText("Escalated")).toBeInTheDocument();
    // The glyph is decoration on top of the word, never a replacement for it.
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("carries its tone as a class so the treatment is a variant, never a restyle", () => {
    const { container } = render(
      <Pill tone="warning" striped onTint>
        Provisional
      </Pill>,
    );

    expect(container.querySelector(".pill")).toHaveClass(
      "pill--warning",
      "pill--on-tint",
      "pill--striped",
    );
  });
});

describe("Badge", () => {
  it("announces what the number counts, because a bare digit means nothing spoken", () => {
    render(<Badge count={3} label="unacknowledged critical alerts" />);

    expect(screen.getByText("3 unacknowledged critical alerts")).toBeInTheDocument();
  });

  it("hides the bare digit from assistive tech, so the count is read once and in context", () => {
    render(<Badge count={3} label="unacknowledged critical alerts" />);

    expect(screen.getByText("3")).toHaveAttribute("aria-hidden");
  });

  it("renders nothing at zero — a permanently visible badge stops meaning 'a human must act'", () => {
    const { container } = render(<Badge count={0} label="unacknowledged critical alerts" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a negative count rather than a minus sign", () => {
    const { container } = render(<Badge count={-1} label="open tickets" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("caps the glyph at 9+ so the badge stays one character wide", () => {
    render(<Badge count={14} label="open tickets" />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("still announces the true count behind the cap, because 14 and 90 are different problems", () => {
    render(<Badge count={14} label="open tickets" />);

    expect(screen.getByText("14 open tickets")).toBeInTheDocument();
  });

  it("honours a caller's own cap", () => {
    render(<Badge count={120} label="open tickets" max={99} />);

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByText("120 open tickets")).toBeInTheDocument();
  });

  it("reserves red for 'a human must act' and offers brand for an informational count", () => {
    const { container } = render(<Badge count={3} label="pending applications" tone="brand" />);

    expect(container.querySelector(".badge")).toHaveClass("badge--brand");
  });
});
