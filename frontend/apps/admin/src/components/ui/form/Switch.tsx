import { useId, type ReactNode } from "react";

import { cx } from "../../../lib/cx";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** The consequence of turning it off — notification channels need this stated plainly. */
  description?: ReactNode;
  disabled?: boolean;
  /** Marks a channel whose loss is dangerous (critical alerts), so the row can warn. */
  tone?: "default" | "danger";
}

/**
 * Settings toggles. A checkbox input under the design's track, so it announces as a switch, toggles
 * with Space, and participates in the form like any other control.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  tone = "default",
}: SwitchProps) {
  const inputId = useId();

  return (
    <label htmlFor={inputId} className={cx("opt-row", disabled && "is-disabled")}>
      <span className="grow">
        <span className={cx("t-body block", tone === "danger" && !checked ? "c-danger" : "c-1")}>
          {label}
        </span>
        {description ? <span className="t-caption c-2 block">{description}</span> : null}
      </span>
      <input
        id={inputId}
        role="switch"
        className="sr-only"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span aria-hidden className={cx("switch", checked && "is-on")} />
    </label>
  );
}
