import { cleanup, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, ToastViewport, useToast } from "./Toast";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

function ToastHarness({ durationMs }: { durationMs?: number | undefined }) {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          title: "Invoice saved",
          tone: "success",
          ...(durationMs === undefined ? {} : { durationMs }),
        })
      }
    >
      Show toast
    </button>
  );
}

function renderToastHarness(durationMs?: number) {
  return render(
    <ToastProvider>
      <ToastHarness durationMs={durationMs} />
      <ToastViewport />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  it("shows a fired toast inside the polite live region", async () => {
    const { container } = renderToastHarness(0);
    await userEvent.click(screen.getByRole("button", { name: "Show toast" }));
    const toastTitle = screen.getByText("Invoice saved");
    expect(toastTitle).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toContainElement(toastTitle);
  });

  it("dismisses via the labelled dismiss button", async () => {
    renderToastHarness(0);
    await userEvent.click(screen.getByRole("button", { name: "Show toast" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Invoice saved")).not.toBeInTheDocument();
  });

  it("auto-dismisses after its duration", async () => {
    renderToastHarness(50);
    await userEvent.click(screen.getByRole("button", { name: "Show toast" }));
    expect(screen.getByText("Invoice saved")).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByText("Invoice saved"));
  });

  it("throws a clear error when useToast is used outside the provider", () => {
    // React logs the thrown render error to console.error — silence just this assertion.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/);
    consoleErrorSpy.mockRestore();
  });
});
