import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "../lib/cn";

// Searchable dropdown (the shadcn Combobox pattern): an Input-like trigger opening a Popover with
// a filter box and a keyboard-navigable listbox. Fully controlled and mouldable: options are data,
// rendering is overridable per-option, every label arrives as a prop (apps localize), and the
// trigger can be replaced entirely via `trigger`.
export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional custom row content; falls back to the label. */
  render?: ReactNode;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: readonly ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Custom filter; default: case-insensitive label match. */
  filter?: (option: ComboboxOption, query: string) => boolean;
  /** Replace the default trigger entirely (receives the current option). */
  trigger?: (selected: ComboboxOption | undefined) => ReactNode;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

const defaultFilter = (option: ComboboxOption, query: string) =>
  option.label.toLowerCase().includes(query.toLowerCase());

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  filter = defaultFilter,
  trigger,
  disabled,
  className,
  contentClassName,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);
  const visible = useMemo(
    () => options.filter((option) => filter(option, query)),
    [options, query, filter],
  );

  const choose = (option: ComboboxOption) => {
    if (option.disabled) return;
    onChange(option.value === value ? null : option.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(Math.max(highlighted + step, 0), visible.length - 1);
      setHighlighted(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && visible[highlighted]) {
      event.preventDefault();
      choose(visible[highlighted]);
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setHighlighted(0);
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        {trigger ? (
          trigger(selected)
        ) : (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border",
              "bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              selected ? "text-ink" : "text-faint",
              className,
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-faint" aria-hidden />
          </button>
        )}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onKeyDown={onKeyDown}
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] min-w-48 rounded-lg border border-border",
            "bg-surface p-1 shadow-overlay",
            contentClassName,
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-2 pb-1.5 pt-1">
            <Search className="size-4 shrink-0 text-faint" aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              placeholder={searchPlaceholder}
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-faint">{emptyText}</li>
            ) : (
              visible.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  data-highlighted={index === highlighted || undefined}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink",
                    "data-[highlighted]:bg-inset",
                    option.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0 text-primary",
                      option.value !== value && "invisible",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{option.render ?? option.label}</span>
                </li>
              ))
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
