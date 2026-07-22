import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CodeInput } from "./CodeInput";

// The regression this file exists for: auto-advance moves focus in the same tick as the keystroke,
// before React has re-rendered with the new value. A focus guard that read the `value` prop saw the
// pre-keystroke string, decided the newly focused cell was past the end, and bounced focus back one
// cell — which silently swallowed every second digit. Typing six digits landed three.

const LENGTH = 6;

function Harness({
  onComplete,
  initialValue = "",
}: {
  onComplete?: (code: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <CodeInput
      value={value}
      onChange={setValue}
      length={LENGTH}
      label="Verification code"
      {...(onComplete ? { onComplete } : {})}
    />
  );
}

function cells(): HTMLInputElement[] {
  return Array.from({ length: LENGTH }, (_unused, index) =>
    screen.getByRole("textbox", { name: `Verification code ${index + 1}` }),
  ) as HTMLInputElement[];
}

function digits(): string {
  return cells()
    .map((cell) => cell.value)
    .join("");
}

describe("typing", () => {
  it("lands six digits when six digits are typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("123456");

    expect(digits()).toBe("123456");
  });

  it("puts each digit in its own cell, in order", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("482913");

    expect(cells().map((cell) => cell.value)).toEqual(["4", "8", "2", "9", "1", "3"]);
  });

  it("advances focus a cell at a time, so the operator never taps between digits", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("12");

    expect(cells()[2]).toHaveFocus();
  });

  it("holds focus on the last cell rather than running off the end", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("123456");

    expect(cells()[LENGTH - 1]).toHaveFocus();
  });

  it("ignores anything that is not a digit, because a code is numeric", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("1a2b3c");

    expect(digits()).toBe("123");
  });

  it("sends a tap on a cell past the filled region back to the first empty one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("12");
    await user.click(cells()[5] as HTMLInputElement);

    // Otherwise the code grows a hole the operator cannot see.
    expect(cells()[2]).toHaveFocus();
  });
});

describe("onComplete", () => {
  it("fires once, at full length, with the whole code", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("123456");

    // The design auto-submits rather than waiting for a tap, so a second call is a second submit.
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("stays silent while the code is still short", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("12345");

    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("paste", () => {
  it("distributes a pasted code across every cell", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.paste("987654");

    expect(digits()).toBe("987654");
  });

  it("strips the spaces and dashes an SMS puts around a code", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.paste("98-76 54");

    expect(digits()).toBe("987654");
  });

  it("truncates an over-long paste rather than dropping it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.paste("1234567890");

    expect(digits()).toBe("123456");
  });

  it("completes on paste, the same as on the sixth keystroke", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.paste("987654");

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("987654");
  });

  it("distributes from the first cell however far down the row it was pasted", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="12" />);

    await user.click(cells()[2] as HTMLInputElement);
    await user.paste("987654");

    expect(digits()).toBe("987654");
  });
});

describe("backspace", () => {
  it("clears from the cell it is in to the end, never collapsing the tail leftward", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="123456" />);

    cells()[3]?.focus();
    await user.keyboard("{Backspace}");

    // Shifting 5 and 6 up into cells 4 and 5 would leave a row that looks half-corrected: the next
    // digit typed lands on a neighbour, and the operator submits a code they never entered.
    expect(cells().map((cell) => cell.value)).toEqual(["1", "2", "3", "", "", ""]);
    expect(cells()[3]).toHaveFocus();
  });

  it("clears the whole code from the first cell, the state a rejected code returns focus to", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="123456" />);

    cells()[0]?.focus();
    await user.keyboard("{Backspace}");

    expect(digits()).toBe("");
    expect(cells()[0]).toHaveFocus();
  });

  it("retreats to the previous cell and clears that one when the current cell is empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("123");
    await user.keyboard("{Backspace}");

    expect(digits()).toBe("12");
    expect(cells()[2]).toHaveFocus();
  });

  it("stops at the first cell instead of stepping off the front of the row", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    cells()[0]?.focus();
    await user.keyboard("{Backspace}{Backspace}");

    expect(cells()[0]).toHaveFocus();
    expect(digits()).toBe("");
  });

  it("lets the operator correct a digit and carry on typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("1235");
    await user.keyboard("{Backspace}");
    await user.keyboard("456");

    expect(digits()).toBe("123456");
  });
});

describe("the group", () => {
  it("names itself for assistive tech and numbers each cell within it", () => {
    render(<Harness />);

    expect(screen.getByRole("group", { name: "Verification code" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Verification code 1" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Verification code 6" })).toBeInTheDocument();
  });

  it("marks every cell invalid when the code was rejected, not just the last one", () => {
    render(
      <CodeInput
        value="123456"
        onChange={vi.fn()}
        length={LENGTH}
        label="Verification code"
        invalid
      />,
    );

    for (const cell of cells()) {
      expect(cell).toHaveAttribute("aria-invalid", "true");
    }
  });

  it("offers SMS autofill for a login code and refuses it for a secret passcode", () => {
    const { rerender } = render(
      <CodeInput value="" onChange={vi.fn()} length={LENGTH} label="Verification code" />,
    );
    expect(cells()[0]).toHaveAttribute("autocomplete", "one-time-code");

    rerender(
      <CodeInput value="" onChange={vi.fn()} length={LENGTH} label="Verification code" masked />,
    );
    // A passcode is a secret; a 2FA code is not.
    const masked = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(masked).toHaveLength(LENGTH);
    expect(masked[0]).toHaveAttribute("autocomplete", "off");
  });

  it("returns focus to the first cell whenever the focus token changes, as it does after a rejection", () => {
    const { rerender } = render(
      <CodeInput
        value="123456"
        onChange={vi.fn()}
        length={LENGTH}
        label="Verification code"
        focusToken={1}
      />,
    );
    cells()[4]?.focus();

    rerender(
      <CodeInput
        value="123456"
        onChange={vi.fn()}
        length={LENGTH}
        label="Verification code"
        focusToken={2}
      />,
    );

    expect(cells()[0]).toHaveFocus();
  });

  it("accepts nothing while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CodeInput value="" onChange={onChange} length={LENGTH} label="Verification code" disabled />,
    );

    await user.click(cells()[0] as HTMLInputElement);
    await user.keyboard("1");

    expect(onChange).not.toHaveBeenCalled();
  });
});
