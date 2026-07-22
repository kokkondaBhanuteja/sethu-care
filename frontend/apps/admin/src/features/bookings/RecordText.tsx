import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

/**
 * The three text treatments the booking screens repeat everywhere, built from token-backed
 * utilities so no feature file reaches into the ported BEM layer.
 *
 * They live in this feature rather than in components/ui because nothing outside bookings needs
 * them yet (ENGINEERING-STANDARDS Part 3.2 — promote on the second consumer, not preemptively).
 */

export interface MonoTextProps {
  children: ReactNode;
  className?: string;
}

/** Booking references, phone numbers and transaction ids: tabular mono, so digits line up. */
export function MonoText({ children, className }: MonoTextProps) {
  return <span className={cx("font-mono text-mono tabular-nums", className)}>{children}</span>;
}

export interface RecordSectionProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** An 11px uppercase caption over a block of record detail — CUSTOMER, PROVIDER, TIMELINE. */
export function RecordSection({ label, children, className }: RecordSectionProps) {
  return (
    <section className={className}>
      <h2 className="text-pill uppercase tracking-wider text-text-2 mb-s3">{label}</h2>
      {children}
    </section>
  );
}

export interface MatchHighlightProps {
  text: string;
  /** The raw search term; non-alphanumerics are ignored so "+91 98765" still matches. */
  query: string;
}

/**
 * Highlights the matched run in place. A phone search is the commonest thing an ops manager types,
 * because the customer is on the line — seeing which digits matched is what makes the result set
 * self-explaining (design BOX 16 / M27).
 */
export function MatchHighlight({ text, query }: MatchHighlightProps) {
  const range = findMatchRange(text, query);
  if (!range) return <>{text}</>;

  return (
    <>
      {text.slice(0, range.start)}
      <mark className="bg-tint-selected text-text-1 rounded-pill px-s1">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

interface MatchRange {
  readonly start: number;
  readonly end: number;
}

/** Matches on significant characters only, then maps the hit back onto the formatted string. */
function findMatchRange(text: string, query: string): MatchRange | null {
  const needle = query.toLowerCase().replace(/[^a-z0-9]/gi, "");
  if (needle.length === 0) return null;

  const positions: number[] = [];
  let condensed = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (/[a-z0-9]/i.test(character)) {
      condensed += character.toLowerCase();
      positions.push(index);
    }
  }

  const hit = condensed.indexOf(needle);
  if (hit === -1) return null;

  const start = positions[hit];
  const end = positions[hit + needle.length - 1];
  if (start === undefined || end === undefined) return null;
  return { start, end: end + 1 };
}
