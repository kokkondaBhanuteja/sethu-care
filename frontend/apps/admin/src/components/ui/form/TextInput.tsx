import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "../../../lib/cx";
import { Field, fieldDescribedBy } from "./Field";

export interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "required"
> {
  label: string;
  required?: boolean;
  error?: string;
  /**
   * Marks the control invalid without printing a message under it. The login screen needs this:
   * on a failed sign-in both fields turn red while a single alert strip carries the reason, because
   * saying which of the two was wrong tells an attacker which half they got right.
   */
  invalid?: boolean;
  hint?: string;
  labelStyle?: "ops" | "plain";
  /** Rendered inside the field, after the input — the password show/hide toggle, a unit, a clear. */
  adornmentEnd?: ReactNode;
  /** Supply when the id must be stable across renders (deep links, label-for from elsewhere). */
  id?: string;
  className?: string;
}

/**
 * Single-line text, email, tel, number and date all render through here — including date, because
 * the design specifies no custom calendar and the native picker is keyboard- and screen-reader
 * -complete on every platform this console runs on.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  {
    label,
    required = false,
    error,
    invalid = false,
    hint,
    labelStyle = "ops",
    adornmentEnd,
    id,
    className,
    type = "text",
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const isInvalid = invalid || Boolean(error);

  const input = (
    <input
      {...rest}
      ref={ref}
      id={fieldId}
      type={type}
      required={required}
      aria-invalid={isInvalid || undefined}
      aria-describedby={fieldDescribedBy(fieldId, {
        hasHint: Boolean(hint),
        hasError: Boolean(error),
      })}
      className={cx(
        "input",
        isInvalid && "input--error",
        Boolean(adornmentEnd) && "pr-s2",
        className,
      )}
    />
  );

  return (
    <Field
      label={label}
      htmlFor={fieldId}
      required={required}
      {...(error ? { error } : {})}
      {...(hint ? { hint } : {})}
      labelStyle={labelStyle}
    >
      {adornmentEnd ? (
        <span className="relative flex items-center">
          {input}
          <span className="absolute right-s2 flex items-center">{adornmentEnd}</span>
        </span>
      ) : (
        input
      )}
    </Field>
  );
});
