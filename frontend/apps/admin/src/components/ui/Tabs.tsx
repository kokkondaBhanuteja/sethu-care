import { useId, type KeyboardEvent } from "react";

import { cx } from "../../lib/cx";

export interface TabItem<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  /** Trailing count, e.g. the 4 open tickets on a customer record. */
  readonly count?: number;
}

export interface TabsProps<TValue extends string> {
  label: string;
  items: readonly TabItem<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
  /** `fill` spreads tabs across the width (mobile); `flush` drops the gutter. */
  variant?: "default" | "fill" | "flush";
  className?: string;
}

/**
 * Switches which slice of one record is shown (Jobs / Documents / History). Arrow keys move between
 * tabs, as the tab pattern requires — the roving tabindex is what makes a tab strip keyboard-usable
 * rather than a row of buttons.
 */
export function Tabs<TValue extends string>({
  label,
  items,
  value,
  onValueChange,
  variant = "default",
  className,
}: TabsProps<TValue>) {
  const baseId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (offset === 0) return;

    event.preventDefault();
    const currentIndex = items.findIndex((item) => item.value === value);
    const next = items[(currentIndex + offset + items.length) % items.length];
    if (next) onValueChange(next.value);
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx(
        "tabs",
        variant === "fill" && "tabs--fill",
        variant === "flush" && "tabs--flush",
        className,
      )}
    >
      {items.map((item) => {
        const isSelected = item.value === value;
        return (
          <button
            key={item.value}
            id={`${baseId}-${item.value}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={cx("tabs__tab", isSelected && "is-active")}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
            {item.count !== undefined ? <span className="c-3"> {item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
