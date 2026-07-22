import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

function renderConfirmDialog(hideCloseButton = false) {
  return render(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent hideCloseButton={hideCloseButton}>
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>This assigns the provider immediately.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("opens from the trigger as an accessible dialog named by its title", async () => {
    renderConfirmDialog();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm booking" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("This assigns the provider immediately.")).toBeInTheDocument();
  });

  it("closes via the labelled X button", async () => {
    renderConfirmDialog();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("omits the X button for confirm-only dialogs", async () => {
    renderConfirmDialog(true);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
