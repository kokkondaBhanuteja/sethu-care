import { cx } from "../../lib/cx";

export const DOT_TONES = {
  success: "dot--success",
  warning: "dot--warning",
  danger: "dot--danger",
  info: "dot--info",
  neutral: "dot--neutral",
} as const;

export type DotTone = keyof typeof DOT_TONES;

export interface StatusDotProps {
  tone: DotTone;
  /** `half` = partially available, `hollow` = known-unknown. Both are in the roster legend. */
  fill?: "solid" | "half" | "hollow";
  size?: "sm" | "md" | "lg";
  /** A slow pulse marks a live, currently-changing value. */
  pulse?: boolean;
  /**
   * What the dot means. Required: a bare colour is not an accessible status, so the label is
   * always rendered — visually next to the dot, or to assistive tech alone when `visualLabel`
   * is false because adjacent text already says it.
   */
  label: string;
  visualLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES = { sm: "dot--6", md: "", lg: "dot--10" } as const;

export function StatusDot({
  tone,
  fill = "solid",
  size = "md",
  pulse = false,
  label,
  visualLabel = false,
  className,
}: StatusDotProps) {
  const dot = (
    <span
      className={cx(
        "dot",
        DOT_TONES[tone],
        SIZE_CLASSES[size],
        fill === "half" && "dot--half",
        fill === "hollow" && "dot--hollow",
        pulse && "dot--pulse",
        className,
      )}
    />
  );

  if (!visualLabel) {
    return (
      <>
        {dot}
        <span className="sr-only">{label}</span>
      </>
    );
  }

  return (
    <span className="row-start">
      {dot}
      <span className="t-label c-2">{label}</span>
    </span>
  );
}
