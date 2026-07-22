import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";
import { Label } from "./Label";

// The refs' filter strip, split into its two layout jobs: FilterField is one labelled unit
// (caption above ANY control — input, select, date picker…), FilterBand lays the units on a
// responsive grid with the primary action ("Show all", Apply) as a slot on the controls'
// baseline. Pure layout — the controls themselves arrive as children, never baked in.
export interface FilterFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  /** Ties the caption to the control's id for screen readers and label-click focus. */
  htmlFor?: string;
  labelClassName?: string;
}

export function FilterField({
  label,
  htmlFor,
  labelClassName,
  className,
  children,
  ...props
}: FilterFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} {...props}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>
      {children}
    </div>
  );
}

export interface FilterBandProps extends HTMLAttributes<HTMLDivElement> {
  /** Primary action(s) — rendered as the last grid cell, bottom-aligned with the controls. */
  actions?: ReactNode;
  actionsClassName?: string;
}

export function FilterBand({
  actions,
  actionsClassName,
  className,
  children,
  ...props
}: FilterBandProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className,
      )}
      {...props}
    >
      {children}
      {actions ? (
        <div className={cn("flex items-end gap-2", actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );
}
