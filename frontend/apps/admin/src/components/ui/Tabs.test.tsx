import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs, type TabItem } from "./Tabs";

// A tab strip that is only a row of buttons is a tab strip a keyboard user has to Tab through one
// destination at a time. The roving tabindex plus arrow keys is the whole difference, and it is
// invisible to anyone testing with a mouse.

type Slice = "jobs" | "documents" | "history";

const ITEMS: readonly TabItem<Slice>[] = [
  { value: "jobs", label: "Jobs", count: 4 },
  { value: "documents", label: "Documents" },
  { value: "history", label: "History" },
];

function Harness({
  items = ITEMS,
  onValueChange,
}: {
  items?: readonly TabItem<Slice>[];
  onValueChange?: (value: Slice) => void;
}) {
  const [value, setValue] = useState<Slice>("jobs");

  return (
    <Tabs
      label="Provider record"
      items={items}
      value={value}
      onValueChange={(next) => {
        onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("structure", () => {
  it("names the strip, so it is announced as one control and not three buttons", () => {
    render(<Harness />);

    expect(screen.getByRole("tablist", { name: "Provider record" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks exactly one tab selected", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: /Jobs/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("reads a tab's count as part of its name", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: /Jobs\s*4/ })).toBeInTheDocument();
  });

  it("states what a tab's status dot means, so a problem on an unopened tab is announced", () => {
    render(
      <Harness
        items={[
          {
            value: "jobs",
            label: "Active",
            dot: { tone: "danger", pulse: true, label: "Escalated" },
          },
          { value: "documents", label: "Documents" },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: /Escalated/ })).toBeInTheDocument();
  });
});

describe("the roving tabindex", () => {
  it("puts one tab stop on the strip, so Tab reaches the panel rather than every tab in turn", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: /Jobs/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves the tab stop with the selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Jobs/ })).toHaveAttribute("tabindex", "-1");
  });
});

describe("arrow keys", () => {
  it("selects the next tab on ArrowRight", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onValueChange).toHaveBeenCalledWith("documents");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
  });

  it("selects the previous tab on ArrowLeft", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");

    expect(screen.getByRole("tab", { name: /Jobs/ })).toHaveAttribute("aria-selected", "true");
  });

  it("wraps from the last tab round to the first", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  });

  it("carries focus to the newly selected tab, so the arrow key never strands it on a tabindex=-1", async () => {
    // Without this the operator's focus sits on a tab that is no longer selected and no longer in
    // the tab order, and a screen reader announces nothing about the slice now on screen.
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Documents" })).toHaveFocus();
  });

  it("ignores keys that are not arrows", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    screen.getByRole("tab", { name: /Jobs/ }).focus();
    await user.keyboard("{ArrowDown}x");

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("pointer", () => {
  it("selects a tab on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "History" }));

    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  });
});
