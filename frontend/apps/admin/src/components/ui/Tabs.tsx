import { useId, useRef, type KeyboardEvent } from "react";

import { cx } from "../../lib/cx";
import { StatusDot, type DotTone } from "./StatusDot";

export interface TabItem<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  /** Trailing count, e.g. the 4 open tickets on a customer record. */
  readonly count?: number;
  /**
   * A leading status dot: the Active tab pulses red when the segment behind it holds an escalation,
   * so a problem is visible from a tab you are not currently on.
   */
  readonly dot?: { readonly tone: DotTone; readonly pulse?: boolean; readonly label: string };
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
  const tabRefs = useRef(new Map<TValue, HTMLButtonElement | null>());

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (offset === 0) return;

    event.preventDefault();
    const currentIndex = items.findIndex((item) => item.value === value);
    const next = items[(currentIndex + offset + items.length) % items.length];
    if (!next) return;

    onValueChange(next.value);
    // Focus follows the selection, as the tab pattern requires. Without this the roving tabindex
    // strands focus on the tab it just took out of the tab order: the next Tab press leaves the
    // strip from an unexpected place, and assistive tech announces nothing about the new slice.
    tabRefs.current.get(next.value)?.focus();
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
            ref={(element) => {
              tabRefs.current.set(item.value, element);
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={cx("tabs__tab", isSelected && "is-selected")}
            onClick={() => onValueChange(item.value)}
          >
            {item.dot ? (
              <StatusDot
                tone={item.dot.tone}
                size="sm"
                pulse={item.dot.pulse ?? false}
                label={item.dot.label}
              />
            ) : null}
            {item.label}
            {item.count !== undefined ? <span className="c-3"> {item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
