import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ROUTES } from "../../routes/routes.constants";
import { AlertBand } from "./AlertBand";
import { BAND } from "./dashboard.fixtures";
import type { AlertBandState } from "./dashboard.types";

// The escalation band is the redesign's tinted danger feature card: count as the headline, the
// worst items beneath, "View all" as the way in. Non-dismissible by design — it leaves only when
// the underlying alert is acknowledged — and absent entirely on a healthy day, because a band
// that sometimes says "nothing" trains the eye to ignore it.

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

  it("headlines the count and announces as an alert", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("alert")).toHaveTextContent("2 need attention");
  });

  it("uses the singular for one and caps the count at 9+", () => {
    renderBand({ ...BAND, criticalCount: 1 }, "desktop");
    expect(screen.getByText("1 needs attention")).toBeInTheDocument();

    renderBand({ ...BAND, criticalCount: 12 }, "desktop");
    expect(screen.getByText("9+ need attention")).toBeInTheDocument();
  });

  it("cites the worst item under the headline — the band points into the queue", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("alert")).toHaveTextContent(/Escalated #B-8823/);
  });

  it("is the tinted danger card, never a raw full-width bar", () => {
    const { container } = renderBand(BAND, "desktop");
    const card = container.querySelector(".bg-danger-bg");
    expect(card).not.toBeNull();
    expect(card?.className).toContain("rounded-card");
  });

  it("offers View all into the feed on desktop", () => {
    renderBand(BAND, "desktop");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      ROUTES.liveAttention,
    );
  });

  it("makes the whole card the tap target on mobile", () => {
    renderBand(BAND, "mobile");
    const link = screen.getByRole("link", { name: "Open the needs-attention list" });
    expect(link).toHaveAttribute("href", ROUTES.liveAttention);
  });
});
