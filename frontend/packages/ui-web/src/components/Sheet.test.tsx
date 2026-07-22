import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./Sheet";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

function renderSheet(side: "right" | "left" | "bottom") {
  return render(
    <Sheet>
      <SheetTrigger>Filters</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Filter bookings</SheetTitle>
          <SheetDescription>Narrow the list by status.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>,
  );
}

describe("Sheet", () => {
  it("opens from the trigger as an accessible dialog named by its title", async () => {
    renderSheet("right");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByRole("dialog", { name: "Filter bookings" })).toBeInTheDocument();
  });

  it("rounds the top edge for the mobile bottom sheet", async () => {
    renderSheet("bottom");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByRole("dialog")).toHaveClass("rounded-t-card");
  });

  it("closes via the labelled X button", async () => {
    renderSheet("right");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
