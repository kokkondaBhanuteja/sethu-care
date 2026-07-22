import type { ReactNode } from "react";

import { cx } from "../../../lib/cx";

export interface FieldProps {
  /** Rendered as a real <label> bound to the control by id — never a floating <span>. */
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Field-level validation message. Its presence is what turns the control red. */
  error?: string;
  /** Format rules or consequences ("The customer sees this"), shown under the control. */
  hint?: string;
  /** `plain` is sentence case for settings; the default is the uppercase ops label. */
  labelStyle?: "ops" | "plain";
  children: ReactNode;
  className?: string;
}

/**
 * The one wrapper every form control sits in. It owns the label binding, the required marker and
 * the aria-describedby wiring, so no control re-implements them and no screen forgets one.
 *
 * Controls read their describedby ids from `fieldDescribedBy(htmlFor, …)`.
 */
export function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  labelStyle = "ops",
  children,
  className,
}: FieldProps) {
  return (
    <div className={cx("field", className)}>
      <label
        htmlFor={htmlFor}
        className={cx("field-label", labelStyle === "plain" && "field-label--plain")}
      >
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden className="c-danger">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </label>

      {children}

      {hint && !error ? (
        <p id={hintId(htmlFor)} className="t-caption c-3">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId(htmlFor)} className="t-caption c-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function hintId(fieldId: string): string {
  return `${fieldId}-hint`;
}

export function errorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/** The aria-describedby value for a control, given whether it currently has a hint and an error. */
export function fieldDescribedBy(
  fieldId: string,
  options: { hasHint?: boolean; hasError?: boolean },
): string | undefined {
  const ids = [
    options.hasError ? errorId(fieldId) : null,
    options.hasHint && !options.hasError ? hintId(fieldId) : null,
  ].filter((value): value is string => value !== null);

  return ids.length > 0 ? ids.join(" ") : undefined;
}
