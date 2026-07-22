import { cn, tabsListVariants, tabsTriggerVariants } from "@sethu/ui-web";

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
 * Switches the data window (Today / Live now) — not the page. Restyled on the @sethu/ui-web
 * `segmented` tab look (P3 migration), but it stays a radiogroup: a segmented control re-queries
 * the same content, so it must announce as scope selection, never as a tab strip.
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
      className={cn(tabsListVariants({ look: "segmented" }), tall && "h-10", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            // data-state drives the ui-web trigger variants, exactly as Radix would set it.
            data-state={isSelected ? "active" : "inactive"}
            className={cn(tabsTriggerVariants({ look: "segmented" }), tall && "py-2")}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
