import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

export interface FilterChip {
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
}

export interface FilterBarProps {
  /** Names the group, e.g. "Filter bookings". */
  label: string;
  chips: readonly FilterChip[];
  onToggle: (id: string) => void;
  /** Trailing controls that are not chips — a date range, a sort select. */
  children?: ReactNode;
  className?: string;
}

/** Toggle filters. Callers pair this with FilteredEmptyState so an empty result is explainable. */
export function FilterBar({ label, chips, onToggle, children, className }: FilterBarProps) {
  return (
    <div className={cx("filterbar", className)} role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.isActive}
          className={cx("filter-pill", chip.isActive && "is-active")}
          onClick={() => onToggle(chip.id)}
        >
          {chip.label}
        </button>
      ))}
      {children}
    </div>
  );
}

export interface ChipProps {
  label: string;
  /** Provide to render the chip as removable, with an × that clears this one filter. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

/** A applied-filter token. Removable chips summarise what is currently narrowing a list. */
export function Chip({ label, onRemove, removeLabel, className }: ChipProps) {
  if (!onRemove) return <span className={cx("chip", className)}>{label}</span>;

  return (
    <span className={cx("chip", "chip--removable", className)}>
      {label}
      <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Remove ${label}`}>
        <Icon glyph={X} size="sm" />
      </button>
    </span>
  );
}
