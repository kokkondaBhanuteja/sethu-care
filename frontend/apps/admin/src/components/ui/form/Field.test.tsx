import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field, errorId, fieldDescribedBy, hintId } from "./Field";
import { SelectInput } from "./SelectInput";
import { Slider } from "./Slider";
import { TextArea } from "./TextArea";
import { TextInput } from "./TextInput";

// Field owns the label binding, the required marker and the describedby wiring for every control in
// the console, which is exactly why it is worth testing once and hard: a screen cannot forget any of
// them, so the only way they go wrong is here.

describe("fieldDescribedBy", () => {
  it("points at nothing when there is nothing to describe", () => {
    expect(fieldDescribedBy("reason", {})).toBeUndefined();
  });

  it("points at the hint while the field is valid", () => {
    expect(fieldDescribedBy("reason", { hasHint: true })).toBe(hintId("reason"));
  });

  it("points at the error instead of the hint once the field is invalid", () => {
    // Field stops rendering the hint when there is an error, so describing both would leave a
    // dangling id and swallow the error announcement.
    expect(fieldDescribedBy("reason", { hasHint: true, hasError: true })).toBe(errorId("reason"));
  });
});

describe("the label binding", () => {
  it("binds a real label to the control, so clicking the text focuses the input", async () => {
    const user = userEvent.setup();
    render(<TextInput label="Reason" />);

    await user.click(screen.getByText("Reason"));

    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveFocus();
  });

  it("wraps the control the caller gives it, whatever that control is", () => {
    render(
      <Field label="Zone" htmlFor="zone">
        <input id="zone" />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Zone" })).toBeInTheDocument();
  });
});

describe("the required marker", () => {
  it("announces 'required' in words, because the asterisk alone reads as nothing", () => {
    render(<TextInput label="Reason" required />);

    expect(screen.getByRole("textbox", { name: /Reason \(required\)/ })).toBeInTheDocument();
  });

  it("hides the asterisk from assistive tech, so it is never read as punctuation", () => {
    render(<TextInput label="Reason" required />);

    expect(screen.getByText("*")).toHaveAttribute("aria-hidden");
  });

  it("says nothing about requiredness on an optional field", () => {
    render(<TextInput label="Internal note" />);

    expect(screen.getByRole("textbox", { name: "Internal note" })).toBeInTheDocument();
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });
});

describe("hints and errors", () => {
  it("describes the control with its hint, so the format rule is read with the field", () => {
    render(<TextInput label="Refund amount" hint="The customer sees this amount." />);

    expect(screen.getByRole("textbox", { name: "Refund amount" })).toHaveAccessibleDescription(
      "The customer sees this amount.",
    );
  });

  it("swaps the description to the error when one arrives", () => {
    render(
      <TextInput
        label="Refund amount"
        hint="The customer sees this amount."
        error="Above the goodwill cap."
      />,
    );

    expect(screen.getByRole("textbox", { name: "Refund amount" })).toHaveAccessibleDescription(
      "Above the goodwill cap.",
    );
    // Two descriptions at once buries the one that blocks the submit.
    expect(screen.queryByText("The customer sees this amount.")).not.toBeInTheDocument();
  });

  it("raises the error as an alert, so it is announced without the operator hunting for it", () => {
    render(<TextInput label="Refund amount" error="Above the goodwill cap." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Above the goodwill cap.");
  });

  it("describes nothing when there is neither hint nor error", () => {
    render(<TextInput label="Refund amount" />);

    expect(screen.getByRole("textbox", { name: "Refund amount" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });
});

describe("aria-invalid", () => {
  it("is absent on a valid control, so nothing reads as broken before it is", () => {
    render(<TextInput label="Reason" />);

    expect(screen.getByRole("textbox", { name: "Reason" })).not.toHaveAttribute("aria-invalid");
  });

  it("appears once the field carries an error", () => {
    render(<TextInput label="Reason" error="Pick a reason code." />);

    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveAttribute("aria-invalid", "true");
  });

  it("appears for a field marked invalid without a message of its own", () => {
    // The login screen turns both fields red under a single alert strip, because naming the wrong
    // one tells an attacker which half they got right.
    render(<TextInput label="Email" invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("TextArea", () => {
  it("binds, describes and marks itself exactly as a text input does", () => {
    render(
      <TextArea label="Reason note" required error="At least 20 characters." tall />,
    );

    const textarea = screen.getByRole("textbox", { name: /Reason note \(required\)/ });
    expect(textarea).toHaveAccessibleDescription("At least 20 characters.");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });

  it("counts characters politely, since the audit log stores this note verbatim", () => {
    render(<TextArea label="Reason note" maxLength={200} valueLength={34} />);

    const counter = screen.getByText("34/200");
    expect(counter).toHaveAttribute("aria-live", "polite");
  });

  it("shows no counter when the caller gives it no budget to count against", () => {
    render(<TextArea label="Reason note" />);

    expect(screen.queryByText(/\/\d+$/)).not.toBeInTheDocument();
  });
});

describe("SelectInput", () => {
  const REASONS = [
    { value: "provider_no_show", label: "Provider no-show" },
    { value: "customer_request", label: "Customer request" },
    { value: "duplicate", label: "Duplicate booking", disabled: true },
  ];

  it("is a real select, keyboard- and screen-reader-complete without reimplementation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectInput label="Reason code" options={REASONS} defaultValue="" onChange={onChange} />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Reason code" }),
      "customer_request",
    );

    expect(onChange).toHaveBeenCalled();
  });

  it("offers a disabled placeholder, so a reason-code picker never defaults to a real reason", () => {
    render(
      <SelectInput
        label="Reason code"
        options={REASONS}
        placeholder="Select a reason"
        defaultValue=""
      />,
    );

    expect(screen.getByRole("option", { name: "Select a reason" })).toBeDisabled();
  });

  it("carries a per-option disabled state through to the DOM", () => {
    render(<SelectInput label="Reason code" options={REASONS} defaultValue="" />);

    expect(screen.getByRole("option", { name: "Duplicate booking" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Provider no-show" })).toBeEnabled();
  });

  it("wires its error the same way every other control does", () => {
    render(<SelectInput label="Reason code" options={REASONS} error="Pick a reason." />);

    const select = screen.getByRole("combobox", { name: "Reason code" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Pick a reason.");
  });
});

describe("Slider", () => {
  const formatValue = (value: number) => `₹${value}`;

  it("is a real range input, so arrow keys and Home/End work without reimplementation", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider
        label="Incentive bump"
        value={100}
        onValueChange={onValueChange}
        min={0}
        max={200}
        step={50}
        formatValue={formatValue}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Incentive bump" });
    slider.focus();
    await user.keyboard("{ArrowRight}");

    expect(onValueChange).toHaveBeenCalledWith(150);
  });

  it("speaks the formatted amount, not the raw number — ₹150, not 150", () => {
    render(
      <Slider
        label="Incentive bump"
        value={150}
        onValueChange={vi.fn()}
        min={0}
        max={200}
        formatValue={formatValue}
      />,
    );

    expect(screen.getByRole("slider", { name: "Incentive bump" })).toHaveAttribute(
      "aria-valuetext",
      "₹150",
    );
  });

  it("prints the current value beside the label, because a slider with no readout is a guess", () => {
    render(
      <Slider
        label="Incentive bump"
        value={150}
        onValueChange={vi.fn()}
        min={0}
        max={200}
        formatValue={formatValue}
        minLabel="None"
        maxLabel="₹200"
      />,
    );

    expect(screen.getByText("₹150")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });
});
