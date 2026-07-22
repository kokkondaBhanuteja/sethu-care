import { forwardRef, useId, type SelectHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import { Field, fieldDescribedBy } from "./Field";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectInputProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "id" | "required" | "children"
> {
  label: string;
  options: readonly SelectOption[];
  /** Shown as a disabled first option — reason-code pickers must not default to a real reason. */
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelStyle?: "ops" | "plain";
  id?: string;
  className?: string;
}

/**
 * A native <select>. Deliberate: reason codes and filters are short, flat lists, and the platform
 * control is keyboard-, screen-reader- and touch-complete in a way a custom listbox would have to
 * re-earn. The `.select` class gives it the design's chrome.
 */
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  {
    label,
    options,
    placeholder,
    required = false,
    error,
    hint,
    labelStyle = "ops",
    id,
    className,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <Field
      label={label}
      htmlFor={fieldId}
      required={required}
      {...(error ? { error } : {})}
      {...(hint ? { hint } : {})}
      labelStyle={labelStyle}
    >
      <select
        {...rest}
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, {
          hasHint: Boolean(hint),
          hasError: Boolean(error),
        })}
        className={cx("input", error && "input--error", className)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
});
