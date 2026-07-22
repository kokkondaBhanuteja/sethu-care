import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KpiTile } from "./KpiTile";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

describe("KpiTile", () => {
  it("renders label, value and delta", () => {
    render(
      <KpiTile label="Total Amount" value="₹1,28,400" delta={<span>12% vs last month</span>} />,
    );
    expect(screen.getByText("Total Amount")).toBeInTheDocument();
    expect(screen.getByText("₹1,28,400")).toBeInTheDocument();
    expect(screen.getByText("12% vs last month")).toBeInTheDocument();
  });

  it("is a static region when no onClick is given", () => {
    render(<KpiTile label="Orders" value="1,240" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("becomes a real button with onClick and fires it", async () => {
    const onClick = vi.fn();
    render(<KpiTile label="Orders" value="1,240" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /Orders/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prefers the custom chip slot over the built-in IconChip", () => {
    render(
      <KpiTile
        label="Wallet"
        value="₹4,050"
        icon={<svg data-testid="built-in-glyph" />}
        chip={<span data-testid="custom-chip" />}
      />,
    );
    expect(screen.getByTestId("custom-chip")).toBeInTheDocument();
    expect(screen.queryByTestId("built-in-glyph")).not.toBeInTheDocument();
  });

  it("merges caller classes over variant classes", () => {
    render(<KpiTile label="Orders" value="1,240" data-testid="kpi-tile" className="w-full" />);
    expect(screen.getByTestId("kpi-tile")).toHaveClass("w-full");
  });
});
