import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";

// jsdom ships neither pointer-capture nor ResizeObserver; Radix Select needs both to open.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

function renderServiceSelect(onValueChange: (value: string) => void) {
  render(
    <Select onValueChange={onValueChange}>
      <SelectTrigger aria-label="Service">
        <SelectValue placeholder="All services" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
        <SelectItem value="nursing">Home Nursing</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe("Select", () => {
  it("opens on click and commits the chosen option", async () => {
    const onValueChange = vi.fn();
    renderServiceSelect(onValueChange);
    await userEvent.click(screen.getByRole("combobox", { name: "Service" }));
    await userEvent.click(await screen.findByRole("option", { name: "Home Nursing" }));
    expect(onValueChange).toHaveBeenCalledWith("nursing");
  });

  it("marks the trigger aria-invalid when the invalid variant is set", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Assign Provider" invalid>
          <SelectValue placeholder="All providers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lab">Lab Collection</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Assign Provider" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
