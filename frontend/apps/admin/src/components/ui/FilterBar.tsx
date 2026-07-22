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
  /** Trailing controls that are not toggles — a date range, a sort select, a Clear all. */
  children?: ReactNode;
  className?: string;
}

/**
 * Toggle filters, rendered as selectable chips. Pair with `FilteredEmptyState` so a narrowed list
 * that comes back empty is explainable rather than looking broken.
 */
export function FilterBar({ label, chips, onToggle, children, className }: FilterBarProps) {
  return (
    <div className={cx("filterbar", className)} role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.isActive}
          className={cx("chip", chip.isActive && "is-selected")}
          onClick={() => onToggle(chip.id)}
        >
          {chip.label}
        </button>
      ))}
      {children}
    </div>
  );
}

export interface AppliedFilterProps {
  label: string;
  onRemove: () => void;
  /** Accessible name for the × — say what is being removed, not just "Remove". */
  removeLabel: string;
}

/**
 * An applied filter, summarising what is currently narrowing a list. Always removable: the design
 * gives it the selected-brand treatment precisely so it reads as "this is why you aren't seeing
 * everything", which is only useful if it can be undone in place.
 */
export function AppliedFilter({ label, onRemove, removeLabel }: AppliedFilterProps) {
  return (
    <span className="filter-pill">
      {label}
      <button type="button" onClick={onRemove} aria-label={removeLabel}>
        <Icon glyph={X} size="sm" />
      </button>
    </span>
  );
}

export interface ChipProps {
  label: string;
  className?: string;
}

/** A static, non-interactive tag — a skill, a zone, a service category. */
export function Chip({ label, className }: ChipProps) {
  return <span className={cx("chip", className)}>{label}</span>;
}
