import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

export interface AuditDefListProps {
  /** Desktop pairs the fields two-up; fourteen stacked rows run off a 900px frame (BOX 48). */
  twoColumn?: boolean;
  children: ReactNode;
}

/**
 * A definition list, deliberately: every field is labelled, nothing is inferred from position, and
 * the whole record can be read aloud down a phone line during a dispute (BOX 76).
 */
export function AuditDefList({ twoColumn = false, children }: AuditDefListProps) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-s5", twoColumn && "md:grid-cols-2")}>{children}</dl>
  );
}

export interface AuditDefRowProps {
  label: string;
  /** Spans both columns — used for Target, Note and Evidence, which are long or paired. */
  wide?: boolean;
  children: ReactNode;
}

export function AuditDefRow({ label, wide = false, children }: AuditDefRowProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-s1 py-s3 border-b border-border-subtle",
        wide && "md:col-span-2",
      )}
    >
      <dt className="text-caption text-text-3">{label}</dt>
      {/* break-words, because a pasted reason note must wrap rather than widen the panel. */}
      <dd className="text-label text-text-1 break-words">{children}</dd>
    </div>
  );
}

export interface AuditMonoProps {
  children: ReactNode;
  /** Brand colour marks a value that navigates outward to the record it names. */
  brand?: boolean;
  muted?: boolean;
}

/** Identifiers and timestamps, monospaced with tabular figures so a column of them aligns. */
export function AuditMono({ children, brand = false, muted = false }: AuditMonoProps) {
  return (
    <span
      className={cx(
        "font-mono tabular-nums text-mono",
        brand && "text-brand",
        muted && "text-text-2",
      )}
    >
      {children}
    </span>
  );
}
