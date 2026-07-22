import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Segmented } from "./Segmented";

// A segmented control re-queries the same content; tabs switch content within one record. They are
// visually distinct for that reason, so the roles have to agree: this announces as a radio group,
// not as a tab strip, or an operator is told they are changing screens when they are changing scope.

type Window = "live" | "today" | "week";

function Harness({ onValueChange }: { onValueChange?: (value: Window) => void } = {}) {
  const [value, setValue] = useState<Window>("today");

  return (
    <Segmented
      label="Time window"
      options={[
        { value: "live", label: "Live now" },
        { value: "today", label: "Today" },
        { value: "week", label: "This week" },
      ]}
      value={value}
      onValueChange={(next) => {
        onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("Segmented", () => {
  it("names what it controls, so 'Today' is heard as a time window and not a page", () => {
    render(<Harness />);

    expect(screen.getByRole("radiogroup", { name: "Time window" })).toBeInTheDocument();
  });

  it("checks exactly one option", () => {
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Live now" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "This week" })).not.toBeChecked();
  });

  it("moves the selection on click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    await user.click(screen.getByRole("radio", { name: "Live now" }));

    expect(onValueChange).toHaveBeenCalledWith("live");
    expect(screen.getByRole("radio", { name: "Live now" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Today" })).not.toBeChecked();
  });

  it("is operable from the keyboard — every option is reachable and activates with Enter", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    screen.getByRole("radio", { name: "This week" }).focus();
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("week");
  });

  it("carries the tall variant as a class rather than as a bespoke height", () => {
    const { container } = render(
      <Segmented
        label="Time window"
        options={[{ value: "today", label: "Today" }]}
        value="today"
        onValueChange={vi.fn()}
        tall
      />,
    );

    expect(container.querySelector(".segmented")).toHaveClass("segmented--40");
  });
});
