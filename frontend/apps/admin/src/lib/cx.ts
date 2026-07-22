/**
 * Join class names, dropping anything falsy. Deliberately tiny: the component layer composes a
 * handful of BEM modifiers plus Tailwind utilities, which never conflict with each other, so the
 * merge semantics of a larger helper would buy nothing.
 */
export function cx(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
