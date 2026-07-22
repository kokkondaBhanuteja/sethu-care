import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

export interface MonoTextProps {
  children: ReactNode;
  /** Brand-coloured, for an identifier that is also a link. */
  asLink?: boolean;
  className?: string;
}

/**
 * An identifier — `#B-8823`, `aud_01J8XKQ2M4`, a device id. Monospace with tabular figures so a
 * column of them aligns character-for-character, which is the whole reason an operator can scan a
 * ledger for the one that is wrong.
 */
export function MonoText({ children, asLink = false, className }: MonoTextProps) {
  return <span className={cx("id", asLink && "id--brand", className)}>{children}</span>;
}

export interface RecordSectionProps {
  title: string;
  children: ReactNode;
  /** Trailing affordance for the section — an edit link, a count. */
  action?: ReactNode;
  className?: string;
}

/** A labelled block inside a record view: the 11px uppercase caption over its content. */
export function RecordSection({ title, children, action, className }: RecordSectionProps) {
  return (
    <section className={cx("flex flex-col gap-s2", className)}>
      <div className="flex items-baseline gap-s2">
        <h3 className="field-label grow">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface MatchHighlightProps {
  /** The full value, rendered whole. */
  text: string;
  /** The search term to mark within it. Case-insensitive; empty leaves the text untouched. */
  query: string;
}

/**
 * Marks the matching run inside a search result. Uses `<mark>` rather than a styled span so the
 * match is announced as such, and renders the whole value either way — truncating to the match
 * would hide which record you are actually looking at.
 */
export function MatchHighlight({ text, query }: MatchHighlightProps) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="mark">{text.slice(index, index + trimmed.length)}</mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}
