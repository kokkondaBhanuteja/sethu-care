import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Kbd, KbdGroup } from "./Kbd";

describe("Kbd", () => {
  it("renders a semantic kbd element with its cap text", () => {
    render(
      <KbdGroup aria-label="Command B">
        <Kbd>⌘</Kbd>
        <Kbd>B</Kbd>
      </KbdGroup>,
    );
    const group = screen.getByLabelText("Command B");
    expect(group.querySelectorAll("kbd")).toHaveLength(2);
    expect(screen.getByText("B").tagName).toBe("KBD");
  });
});
