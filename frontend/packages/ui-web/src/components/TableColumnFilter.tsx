import { useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "../lib/cn";

// The Figma table-header filter: a caret beside the column label opening a small option panel
// ("Expired · Expiring in 6M · …" with per-row Select). Controlled multi- or single-select; sits
// inside a <TableHead> next to the label. The trigger stays part of the header's tap target.
export interface TableColumnFilterOption {
  value: string;
  label: string;
  /** Optional trailing visual (a StatusPill preview of the state, a count…). */
  render?: ReactNode;
}

export interface TableColumnFilterProps {
  /** Accessible name, e.g. "Filter by status" (apps localize). */
  label: string;
  options: readonly TableColumnFilterOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  /** Single-select closes on choose; multi keeps the panel open. */
  mode?: "single" | "multi" | undefined;
  /** Shown at the panel foot when anything is selected (e.g. "Clear"). Omit to hide. */
  clearLabel?: string;
  className?: string;
}

export function TableColumnFilter({
  label,
  options,
  selected,
  onChange,
  mode = "multi",
  clearLabel,
  className,
}: TableColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0;

  const toggle = (value: string) => {
    if (mode === "single") {
      onChange(selected[0] === value ? [] : [value]);
      setOpen(false);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((existing) => existing !== value)
        : [...selected, value],
    );
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          data-active={isActive || undefined}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-sm text-faint transition-colors",
            "hover:bg-inset-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring data-[active]:text-primary",
            className,
          )}
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-overlay"
        >
          <ul role="listbox" aria-label={label} aria-multiselectable={mode === "multi"}>
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(option.value)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm normal-case tracking-normal text-ink hover:bg-inset"
                >
                  <Check
                    className={cn("size-4 shrink-0 text-primary", !isSelected && "invisible")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-left font-normal">
                    {option.label}
                  </span>
                  {option.render}
                </li>
              );
            })}
          </ul>
          {clearLabel && isActive ? (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-left text-sm font-normal normal-case tracking-normal text-link hover:bg-inset"
            >
              {clearLabel}
            </button>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
