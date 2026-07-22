import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import { Field, fieldDescribedBy } from "./Field";

export interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "required"
> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelStyle?: "ops" | "plain";
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
    hint,
    labelStyle = "ops",
    id,
    className,
    type = "text",
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
      <input
        {...rest}
        ref={ref}
        id={fieldId}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, {
          hasHint: Boolean(hint),
          hasError: Boolean(error),
        })}
        className={cx("input", error && "input--error", className)}
      />
    </Field>
  );
});
