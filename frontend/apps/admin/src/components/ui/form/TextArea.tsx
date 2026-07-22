import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import { Field, fieldDescribedBy } from "./Field";

export interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "id" | "required"
> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelStyle?: "ops" | "plain";
  /** Taller variant for reason notes, which the audit log will store verbatim. */
  tall?: boolean;
  /** Shows a live character counter — reason notes have minimums the backend enforces. */
  maxLength?: number;
  /** Current length, so the counter reflects the form's value rather than reading the DOM. */
  valueLength?: number;
  id?: string;
  className?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    label,
    required = false,
    error,
    hint,
    labelStyle = "ops",
    tall = false,
    maxLength,
    valueLength,
    id,
    className,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const showCounter = maxLength !== undefined && valueLength !== undefined;

  return (
    <Field
      label={label}
      htmlFor={fieldId}
      required={required}
      {...(error ? { error } : {})}
      {...(hint ? { hint } : {})}
      labelStyle={labelStyle}
    >
      <textarea
        {...rest}
        ref={ref}
        id={fieldId}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, {
          hasHint: Boolean(hint),
          hasError: Boolean(error),
        })}
        className={cx("textarea", tall && "textarea--120", error && "textarea--error", className)}
      />
      {showCounter ? (
        <p className={cx("counter", error && "counter--error")} aria-live="polite">
          {valueLength}/{maxLength}
        </p>
      ) : null}
    </Field>
  );
});
