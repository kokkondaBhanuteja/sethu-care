import { useEffect, useId, useRef } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

import { cx } from "../../../lib/cx";

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

  // The committed code, updated synchronously by `commit`.
  //
  // This has to exist because auto-advance moves focus in the same tick as the keystroke, before
  // React has re-rendered with the new `value`. The onFocus guard below therefore cannot read the
  // `value` prop: it would still hold the pre-keystroke string, decide the newly focused cell is
  // "past the end", and bounce focus back one cell — which silently swallowed every second digit.
  const committedRef = useRef(value);
  useEffect(() => {
    committedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (focusToken === undefined) return;
    cellRefs.current[0]?.focus();
  }, [focusToken]);

  function focusCell(index: number): void {
    cellRefs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function commit(next: string): void {
    const trimmed = next.slice(0, length);
    committedRef.current = trimmed;
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
      // Deletes to the end, not just this cell: the row only ever holds a gapless prefix (the
      // onFocus guard below keeps the same invariant), so blanking one cell and re-joining would
      // shift every later digit up one and the next keystroke would overwrite a neighbour.
      const committed = committedRef.current;
      const target = committed[index] ? index : Math.max(index - 1, 0);
      commit(committed.slice(0, target));
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
          // Clicking a cell past the filled region would leave a hole; send it to the first empty
          // one. Reads the ref, not the prop — see the note on committedRef above.
          onFocus={(event) => {
            if (index > committedRef.current.length) focusCell(committedRef.current.length);
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
