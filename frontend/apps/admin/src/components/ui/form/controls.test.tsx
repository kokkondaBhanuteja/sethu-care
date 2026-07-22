import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";

// Each of these puts a real native input under the design's chrome. That is the whole design
// decision worth protecting: the moment one becomes a styled <div>, keyboard operation and the
// checked-state announcement have to be re-earned, and they never are.

describe("Checkbox", () => {
  it("announces as a checkbox named by its label", () => {
    render(<Checkbox checked={false} onCheckedChange={vi.fn()} label="Customer contacted" />);

    expect(screen.getByRole("checkbox", { name: /Customer contacted/ })).not.toBeChecked();
  });

  it("reports its checked state, not merely a tick glyph", () => {
    render(<Checkbox checked onCheckedChange={vi.fn()} label="Customer contacted" />);

    expect(screen.getByRole("checkbox", { name: /Customer contacted/ })).toBeChecked();
  });

  it("toggles on click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange} label="Customer contacted" />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Customer contacted/ }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles with the Space key, the native behaviour a styled div would lose", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange} label="Customer contacted" />,
    );

    screen.getByRole("checkbox", { name: /Customer contacted/ }).focus();
    await user.keyboard(" ");

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reads its description as part of its name, so the consequence is heard with the choice", () => {
    render(
      <Checkbox
        checked={false}
        onCheckedChange={vi.fn()}
        label="Notify the customer"
        description="They receive an SMS immediately."
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /They receive an SMS immediately\./ }),
    ).toBeInTheDocument();
  });

  it("accepts nothing while disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Customer contacted"
        disabled
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Customer contacted/ });
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("RadioGroup", () => {
  const REASONS = [
    { value: "provider_no_show", label: "Provider no-show" },
    { value: "customer_request", label: "Customer request" },
    { value: "duplicate", label: "Duplicate booking", disabled: true },
  ] as const;

  function ReasonPicker({ error }: { error?: string } = {}) {
    const [value, setValue] = useState<string | null>(null);
    return (
      <RadioGroup
        legend="Cancellation reason"
        options={REASONS}
        value={value}
        onValueChange={setValue}
        {...(error ? { error } : {})}
      />
    );
  }

  it("names the group by its legend, so the question is heard before the answers", () => {
    render(<ReasonPicker />);

    expect(screen.getByRole("group", { name: "Cancellation reason" })).toBeInTheDocument();
  });

  it("offers real radios, which is what gives the group one tab stop and arrow-key movement", () => {
    render(<ReasonPicker />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    // A shared name is what makes them one group to the browser rather than three toggles.
    const names = new Set(radios.map((radio) => radio.getAttribute("name")));
    expect(names.size).toBe(1);
  });

  it("selects exactly one option at a time", async () => {
    const user = userEvent.setup();
    render(<ReasonPicker />);

    await user.click(screen.getByRole("radio", { name: /Provider no-show/ }));
    expect(screen.getByRole("radio", { name: /Provider no-show/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Customer request/ }));
    expect(screen.getByRole("radio", { name: /Customer request/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Provider no-show/ })).not.toBeChecked();
  });

  it("selects with the Space key on a focused option", async () => {
    const user = userEvent.setup();
    render(<ReasonPicker />);

    screen.getByRole("radio", { name: /Customer request/ }).focus();
    await user.keyboard(" ");

    expect(screen.getByRole("radio", { name: /Customer request/ })).toBeChecked();
  });

  it("refuses a disabled option", async () => {
    const user = userEvent.setup();
    render(<ReasonPicker />);

    const disabled = screen.getByRole("radio", { name: /Duplicate booking/ });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(disabled).not.toBeChecked();
  });

  it("starts with nothing chosen, because a reason code must never default to a real reason", () => {
    render(<ReasonPicker />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("marks the whole group invalid and describes it with the message", () => {
    render(<ReasonPicker error="Pick a reason before continuing." />);

    const group = screen.getByRole("group", { name: "Cancellation reason" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Pick a reason before continuing.");
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a reason before continuing.");
  });

  it("reads each option's consequence with its label — reason codes differ in outcome", () => {
    render(
      <RadioGroup
        legend="Cancellation reason"
        options={[
          {
            value: "provider_no_show",
            label: "Provider no-show",
            description: "The provider is penalised and the customer refunded in full.",
          },
        ]}
        value={null}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /The provider is penalised and the customer refunded/ }),
    ).toBeInTheDocument();
  });
});

describe("Switch", () => {
  it("announces as a switch, not as a checkbox", () => {
    render(<Switch checked onCheckedChange={vi.fn()} label="Critical alerts" />);

    expect(screen.getByRole("switch", { name: /Critical alerts/ })).toBeChecked();
  });

  it("reports the off state, so a disabled channel is audible", () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} label="Critical alerts" />);

    expect(screen.getByRole("switch", { name: /Critical alerts/ })).not.toBeChecked();
  });

  it("toggles with Space, so a settings screen is operable without a pointer", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Critical alerts" />);

    screen.getByRole("switch", { name: /Critical alerts/ }).focus();
    await user.keyboard(" ");

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles on click of the row, because the whole row is the target on a phone", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={onCheckedChange} label="Critical alerts" />);

    await user.click(screen.getByText("Critical alerts"));

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("states the consequence of turning it off as part of its own name", () => {
    render(
      <Switch
        checked
        onCheckedChange={vi.fn()}
        label="Critical alerts"
        description="You stop being paged when a booking is stranded."
        tone="danger"
      />,
    );

    expect(
      screen.getByRole("switch", { name: /You stop being paged when a booking is stranded\./ }),
    ).toBeInTheDocument();
  });

  it("accepts nothing while disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={onCheckedChange} label="Critical alerts" disabled />);

    const control = screen.getByRole("switch", { name: /Critical alerts/ });
    expect(control).toBeDisabled();
    await user.click(control);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
