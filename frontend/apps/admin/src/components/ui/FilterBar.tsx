import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@sethu/ui-web";

import { Icon } from "./Icon";

/* Restyled on global tokens (P3 migration). The API is unchanged; the chip-toggle row keeps its
 * own anatomy because ui-web's FilterBand/FilterField model labelled controls on a grid, not
 * toggle chips. Selected chips take the tinted info pill treatment from the reference language. */

const CHIP_CLASSES =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3 " +
  "text-sm font-medium text-muted transition-colors hover:bg-inset focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const CHIP_SELECTED_CLASSES = "border-info-border bg-info-bg text-primary hover:bg-info-bg";

/** The one chip look, exported so count-carrying chip rows (dashboard filters) stay identical. */
export function filterChipClassName(isSelected: boolean): string {
  return cn(CHIP_CLASSES, isSelected && CHIP_SELECTED_CLASSES);
}

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
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label={label}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.isActive}
          className={cn(CHIP_CLASSES, chip.isActive && CHIP_SELECTED_CLASSES)}
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
 * An applied filter, summarising what is currently narrowing a list. Always removable: the
 * selected-brand treatment reads as "this is why you aren't seeing everything", which is only
 * useful if it can be undone in place.
 */
export function AppliedFilter({ label, onRemove, removeLabel }: AppliedFilterProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
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
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-sm text-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}
