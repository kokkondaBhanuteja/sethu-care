import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { cx } from "../../../lib/cx";
import { Icon } from "../Icon";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Second line under the label — consequences, counts, "the customer is notified". */
  description?: ReactNode;
  disabled?: boolean;
  /** Renders the row as a bordered card, the treatment the evidence checklists use. */
  asCard?: boolean;
  name?: string;
  value?: string;
}

/** A real <input type="checkbox"> under the design's box, so keyboard and AT behaviour is native. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  asCard = false,
  name,
  value,
}: CheckboxProps) {
  const inputId = useId();

  return (
    <label
      htmlFor={inputId}
      className={cx("opt-row", asCard && "opt-row--card", disabled && "is-disabled")}
    >
      <input
        id={inputId}
        className="sr-only"
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span aria-hidden className={cx("checkbox", checked && "is-checked")}>
        <Icon glyph={Check} size="sm" />
      </span>
      <span className="grow">
        <span className="t-body c-1 block">{label}</span>
        {description ? <span className="t-caption c-2 block">{description}</span> : null}
      </span>
    </label>
  );
}
