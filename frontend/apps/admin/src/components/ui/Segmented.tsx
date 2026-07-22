import { cx } from "../../lib/cx";

export interface SegmentedOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export interface SegmentedProps<TValue extends string> {
  /** What the group controls, e.g. "Time window". Named for assistive tech. */
  label: string;
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
  /** 40px variant for section-level placement. */
  tall?: boolean;
  className?: string;
}

/**
 * Switches the data window (Today / Live now) — not the page. Tabs switch content within a record;
 * a segmented control re-queries the same content. The design keeps them visually distinct for
 * exactly that reason, so pick by meaning, not by looks.
 */
export function Segmented<TValue extends string>({
  label,
  options,
  value,
  onValueChange,
  tall = false,
  className,
}: SegmentedProps<TValue>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("segmented", tall && "segmented--40", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cx("segmented__opt", option.value === value && "is-selected")}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
