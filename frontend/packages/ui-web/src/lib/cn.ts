import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class lists with Tailwind-aware conflict resolution — the composition primitive every
 *  component uses for its `className` override point. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
