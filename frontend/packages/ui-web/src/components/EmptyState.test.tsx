import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

describe("EmptyState", () => {
  it("renders title, body and action together", () => {
    render(
      <EmptyState title="No bookings yet" action={<button type="button">Create Booking</button>}>
        When customers book a service it will show up here.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No bookings yet" })).toBeInTheDocument();
    expect(
      screen.getByText("When customers book a service it will show up here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Booking" })).toBeInTheDocument();
  });

  it("renders the icon slot content", () => {
    render(<EmptyState title="Nothing here" icon={<svg data-testid="empty-icon" />} />);
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });

  it("stays minimal with only a title", () => {
    render(<EmptyState title="Nothing to show" />);
    expect(screen.getByRole("heading", { name: "Nothing to show" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
