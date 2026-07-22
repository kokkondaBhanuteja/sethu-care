import type { ReactNode } from "react";

import { cx } from "../../../lib/cx";

export const SECTION_LABEL_TONES = {
  muted: "text-text-2",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export type SectionLabelTone = keyof typeof SECTION_LABEL_TONES;

export interface SectionLabelProps {
  children: ReactNode;
  tone?: SectionLabelTone;
  className?: string;
}

/** The small uppercase caption the record screens put over every group of facts. */
export function SectionLabel({ children, tone = "muted", className }: SectionLabelProps) {
  return (
    <span
      className={cx(
        "block text-pill uppercase tracking-wide",
        SECTION_LABEL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
