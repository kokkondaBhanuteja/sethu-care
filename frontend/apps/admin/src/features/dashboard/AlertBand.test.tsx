import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AlertBand } from "./AlertBand";
import { ESCALATED_ATTENTION_LINK } from "./dashboard.constants";
import { BAND } from "./dashboard.fixtures";
import type { AlertBandState } from "./dashboard.types";

// The escalation band is the redesign's tinted danger feature card: count as the headline and
// "View all" as the way in. It counts CRITICAL ESCALATIONS and says exactly that — "needs
// attention" belongs to the queue alone, so the band can never look like it contradicts the
// sidebar's queue count. Non-dismissible by design — it leaves only when the underlying alert is
// acknowledged — and absent entirely on a healthy day, because a band that sometimes says
// "nothing" trains the eye to ignore it.

const HEALTHY: AlertBandState = { criticalCount: 0, examples: [] };

function renderBand(band: AlertBandState, variant: "desktop" | "mobile") {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  }
  return render(<AlertBand band={band} variant={variant} />, { wrapper: Wrapper });
}

describe("AlertBand", () => {
  it("renders nothing at all on a healthy day", () => {
    const { container } = renderBand(HEALTHY, "desktop");
    expect(container).toBeEmptyDOMElement();
  });

  it("headlines the count in the band's own vocabulary and announces as an alert", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("alert")).toHaveTextContent("2 critical escalations");
  });

  it("uses the singular for one and caps the count at 9+", () => {
    renderBand({ ...BAND, criticalCount: 1 }, "desktop");
    expect(screen.getByText("1 critical escalation")).toBeInTheDocument();

    renderBand({ ...BAND, criticalCount: 12 }, "desktop");
    expect(screen.getByText("9+ critical escalations")).toBeInTheDocument();
  });

  it("cites the worst item on mobile, where the queue is a navigation away", () => {
    renderBand(BAND, "mobile");
    expect(screen.getByRole("alert")).toHaveTextContent(/Escalated #B-8823/);
  });

  it("omits the example lines on desktop — the queue table opens directly beneath the band", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/#B-8823/);
  });

  it("is the tinted danger card, never a raw full-width bar", () => {
    const { container } = renderBand(BAND, "desktop");
    const card = container.querySelector(".bg-danger-bg");
    expect(card).not.toBeNull();
    expect(card?.className).toContain("rounded-card");
  });

  it("deep-links View all into the queue pre-filtered to the escalations it counted", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      ESCALATED_ATTENTION_LINK,
    );
  });

  it("makes the whole card the tap target on mobile, filtered the same way", () => {
    renderBand(BAND, "mobile");
    const link = screen.getByRole("link", { name: "Open the needs-attention list" });
    expect(link).toHaveAttribute("href", ESCALATED_ATTENTION_LINK);
  });
});
