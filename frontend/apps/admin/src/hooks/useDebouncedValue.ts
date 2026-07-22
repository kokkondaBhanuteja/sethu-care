import { useEffect, useState } from "react";

/** Long enough to skip intermediate keystrokes, short enough that search still feels immediate. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Delays a value until it stops changing. Search fields feed this rather than the query directly,
 * so typing "Kompally" is one request instead of eight — which matters on a queue an operator
 * filters while a booking is escalating.
 */
export function useDebouncedValue<TValue>(
  value: TValue,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
