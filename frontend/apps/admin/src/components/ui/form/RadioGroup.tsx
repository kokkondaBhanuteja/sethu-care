import { useId, type ReactNode } from "react";

import { cx } from "../../../lib/cx";
import { errorId } from "./Field";

export interface RadioOption<TValue extends string> {
  readonly value: TValue;
  readonly label: ReactNode;
  /** The consequence of choosing this — reason codes carry very different outcomes. */
  readonly description?: ReactNode;
  readonly disabled?: boolean;
}

export interface RadioGroupProps<TValue extends string> {
  /** The group's own label, rendered as the fieldset legend. */
  legend: string;
  options: readonly RadioOption<TValue>[];
  value: TValue | null;
  onValueChange: (value: TValue) => void;
  /** Colours the selection red — used where every option is a destructive outcome. */
  tone?: "brand" | "danger";
  asCards?: boolean;
  error?: string;
  required?: boolean;
  name?: string;
}

/**
 * A real <fieldset>/<legend> with native radios: arrow-key navigation inside the group and a single
 * tab stop come free, which matters on the reason-code pickers that gate every destructive flow.
 */
export function RadioGroup<TValue extends string>({
  legend,
  options,
  value,
  onValueChange,
  tone = "brand",
  asCards = false,
  error,
  required = false,
  name,
}: RadioGroupProps<TValue>) {
  const groupId = useId();
  const groupName = name ?? groupId;

  return (
    <fieldset
      className="field"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId(groupId) : undefined}
      aria-required={required || undefined}
    >
      <legend className="field-label">{legend}</legend>

      {options.map((option) => (
        <label
          key={option.value}
          className={cx("opt-row", asCards && "opt-row--card", option.disabled && "is-disabled")}
        >
          <input
            className="sr-only"
            type="radio"
            name={groupName}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
          />
          <span
            aria-hidden
            className={cx(
              "radio",
              tone === "danger" && "radio--danger",
              value === option.value && "is-checked",
            )}
          />
          <span className="grow">
            <span className="t-body c-1 block">{option.label}</span>
            {option.description ? (
              <span className="t-caption c-2 block">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}

      {error ? (
        <p id={errorId(groupId)} className="t-caption c-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
