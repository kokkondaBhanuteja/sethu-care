import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SettingsGroup } from "./SettingsGroup";

// The group is the unit the whole settings family is built from. Its header anatomy — icon,
// uppercase title, optional one-line description, optional footnote — is what the restructure
// leans on for "every card says what it is for", so it is asserted here once for every screen.

describe("SettingsGroup", () => {
  it("renders the title as a heading with its description under it", () => {
    render(
      <SettingsGroup title="Quiet hours" description="When alerts wait instead of ringing.">
        <div>rows</div>
      </SettingsGroup>,
    );

    expect(screen.getByRole("heading", { name: "Quiet hours" })).toBeInTheDocument();
    expect(screen.getByText("When alerts wait instead of ringing.")).toBeInTheDocument();
  });

  it("keeps the icon decorative — the title alone names the group", () => {
    render(
      <SettingsGroup title="Notifications" icon={Bell}>
        <div>rows</div>
      </SettingsGroup>,
    );

    const heading = screen.getByRole("heading", { name: "Notifications" });
    const glyph = heading.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no heading at all when the group is untitled", () => {
    render(
      <SettingsGroup>
        <div>identity card</div>
      </SettingsGroup>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("identity card")).toBeInTheDocument();
  });

  it("states the group-level footnote outside the card", () => {
    render(
      <SettingsGroup title="Trusted devices" foot="Device limit reached." footTone="warning">
        <div>rows</div>
      </SettingsGroup>,
    );

    expect(screen.getByText("Device limit reached.")).toBeInTheDocument();
  });
});
