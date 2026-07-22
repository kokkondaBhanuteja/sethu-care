import { useTranslation } from "@sethu/i18n";

import { cx } from "../../../lib/cx";

/**
 * U+2605 BLACK STAR. The bundled fonts carry this glyph specifically, which is why the design
 * writes ratings as "★ 4.8" rather than shipping a filled icon at four different sizes.
 */
const STAR = "★";

export const RATING_TONES = {
  neutral: "text-text-2",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export type RatingTone = keyof typeof RATING_TONES;

export interface RatingValueProps {
  value: number;
  tone?: RatingTone;
  /** Renders "★4" with no space — the compact form the job tables use. */
  tight?: boolean;
  className?: string;
}

export function RatingValue({
  value,
  tone = "neutral",
  tight = false,
  className,
}: RatingValueProps) {
  const { t } = useTranslation("adminProviders");
  const text = tight ? `${STAR}${value}` : `${STAR} ${value}`;

  return (
    <span className={cx("whitespace-nowrap tabular-nums", RATING_TONES[tone], className)}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">
        {t("profile.metricRating")}: {value}
      </span>
    </span>
  );
}
