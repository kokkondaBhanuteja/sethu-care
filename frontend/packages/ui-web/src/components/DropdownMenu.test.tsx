import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

// jsdom lacks the layout/pointer APIs Radix popovers rely on — stub just enough to open a menu.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

function renderRowActionsMenu(onSelectEdit: () => void) {
  return render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Invoice INV-2041</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onSelectEdit}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe("DropdownMenu", () => {
  it("opens on click and fires onSelect for an item", async () => {
    const onSelectEdit = vi.fn();
    renderRowActionsMenu(onSelectEdit);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Invoice INV-2041")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onSelectEdit).toHaveBeenCalledOnce();
  });

  it("tints destructive items with the danger tone", async () => {
    renderRowActionsMenu(vi.fn());
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: "Delete" })).toHaveClass("text-danger-fg");
  });
});
