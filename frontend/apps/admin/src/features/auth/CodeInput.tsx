import { useEffect, useId, useRef } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

import { cx } from "../../lib/cx";

/** Cell geometry. The two-factor code and the device passcode must not look alike (design BOX 94). */
export const CODE_INPUT_SIZES = {
  /** 48x56 — mobile two-factor. */
  mobile: "",
  /** 56x60 — desktop two-factor, bled 8px either side so six cells stay one row. */
  desktop: "otp--desktop",
  /** 40x48 — a device passcode, deliberately smaller than a login code. */
  passcode: "otp--passcode",
} as const;

export type CodeInputSize = keyof typeof CODE_INPUT_SIZES;

export interface CodeInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Fired once the last cell is filled — the design auto-submits rather than waiting for a tap. */
  onComplete?: (code: string) => void;
  length: number;
  /** Group label for assistive tech; each cell announces its position within it. */
  label: string;
  size?: CodeInputSize;
  invalid?: boolean;
  disabled?: boolean;
  /** Expired codes are greyed rather than cleared — the digits are dead, not wrong (BOX 90). */
  dimmed?: boolean;
  /** Masks entry as dots. A passcode is a secret; a 2FA code is not. */
  masked?: boolean;
  /** Any change returns focus to the first cell, as the design does after a rejection (BOX 56/89). */
  focusToken?: number;
}

const NON_DIGITS = /\D/g;

/**
 * Single-character inputs behind the design's cells: auto-advance, backspace retreat, paste
 * distributed across the row, and SMS one-time-code autofill.
 *
 * PROMOTION CANDIDATE: this is a design-system control, not auth logic, and it is the only file
 * outside `components/ui` and `layouts` that touches the `.otp` classes. It belongs in
 * `components/ui/form/CodeInput.tsx` — moved as-is, with no call-site change.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length,
  label,
  size = "mobile",
  invalid = false,
  disabled = false,
  dimmed = false,
  masked = false,
  focusToken,
}: CodeInputProps) {
  const groupId = useId();
  const cellRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusToken === undefined) return;
    cellRefs.current[0]?.focus();
  }, [focusToken]);

  function focusCell(index: number): void {
    cellRefs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function commit(next: string): void {
    const trimmed = next.slice(0, length);
    onChange(trimmed);
    if (trimmed.length === length) onComplete?.(trimmed);
  }

  function cells(): string[] {
    return Array.from({ length }, (_unused, index) => value[index] ?? "");
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>): void {
    const typed = event.target.value.replace(NON_DIGITS, "");
    if (typed.length === 0) return;

    const next = cells();
    next[index] = typed.slice(-1);
    commit(next.join(""));
    focusCell(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = cells();
      const target = next[index] ? index : Math.max(index - 1, 0);
      next[target] = "";
      commit(next.join(""));
      focusCell(target);
      return;
    }
    if (event.key === "ArrowLeft") focusCell(index - 1);
    if (event.key === "ArrowRight") focusCell(index + 1);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(NON_DIGITS, "").slice(0, length);
    if (!pasted) return;
    commit(pasted);
    focusCell(pasted.length);
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cx("otp", CODE_INPUT_SIZES[size], dimmed && "is-dimmed-50")}
    >
      {cells().map((character, index) => (
        <input
          key={`${groupId}-${index}`}
          ref={(element) => {
            cellRefs.current[index] = element;
          }}
          className={cx("otp__cell text-center", invalid && "is-error")}
          type={masked ? "password" : "text"}
          inputMode="numeric"
          autoComplete={masked ? "off" : "one-time-code"}
          maxLength={1}
          value={character}
          disabled={disabled}
          aria-label={`${label} ${index + 1}`}
          aria-invalid={invalid || undefined}
          // Typing into a cell past the end would leave a hole; send it to the first empty one.
          onFocus={(event) => {
            if (index > value.length) focusCell(value.length);
            else event.target.select();
          }}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
