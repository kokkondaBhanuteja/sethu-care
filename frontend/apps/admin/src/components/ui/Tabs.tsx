import { useId, useRef, type KeyboardEvent } from "react";
import { cn, tabsListVariants, tabsTriggerVariants } from "@sethu/ui-web";

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
 * Restyled on the @sethu/ui-web `underline` tab look (P3 migration) — the variant maps are
 * composed rather than the Radix component because this strip is trigger-only (the record slice
 * renders elsewhere) and its roving-tabindex behaviour is already exactly what the tests pin.
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
      className={cn(
        tabsListVariants({ look: "underline" }),
        variant === "fill" && "w-full [&>[role=tab]]:flex-1",
        variant === "flush" && "gap-4",
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
            // data-state drives the ui-web trigger variants, exactly as Radix would set it.
            data-state={isSelected ? "active" : "inactive"}
            className={cn(
              tabsTriggerVariants({ look: "underline" }),
              "inline-flex items-center justify-center gap-1.5",
            )}
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
            {item.count !== undefined ? <span className="text-faint"> {item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
