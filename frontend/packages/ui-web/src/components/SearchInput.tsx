import { Search, X } from "lucide-react";

import { cn } from "../lib/cn";
import { Input, type InputProps } from "./Input";

// The refs' list/table search: magnifier leading, and a clear affordance that only exists once
// there is something to clear. Controlled-friendly by design — the caller owns `value`, and
// `onClear` lets it reset state without re-implementing the anatomy. `clearLabel` is a prop
// because localisation lives in the apps, never in this package.
export interface SearchInputProps extends Omit<InputProps, "leading" | "trailing"> {
  /** Accessible name for the clear button — caller localizes. */
  clearLabel: string;
  /** Fired by the clear button; typically resets the controlled `value` to "". */
  onClear?: () => void;
  clearButtonClassName?: string;
}

export function SearchInput({
  clearLabel,
  onClear,
  clearButtonClassName,
  value,
  ...props
}: SearchInputProps) {
  const hasValue = value !== undefined && String(value).length > 0;
  return (
    <Input
      value={value}
      leading={<Search aria-hidden className="text-faint" />}
      trailing={
        hasValue ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={onClear}
            className={cn(
              "rounded-sm p-0.5 text-faint transition-colors hover:text-ink " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              clearButtonClassName,
            )}
          >
            <X />
          </button>
        ) : undefined
      }
      {...props}
    />
  );
}
