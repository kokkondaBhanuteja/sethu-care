import { useId, useState, type ReactNode } from "react";

export interface TooltipProps {
  /** Short clarification. Anything longer belongs in the body copy, not a hover. */
  content: string;
  children: ReactNode;
}

/**
 * Supplementary detail on hover or focus, restyled on global tokens (P3 migration; ui-web ships
 * no Tooltip component yet, so the app-owned implementation stays).
 *
 * Never the only carrier of meaning: tooltips are unreachable on touch, which is half this
 * console's surface area. Anything an operator must know is on the screen.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span aria-describedby={tooltipId}>{children}</span>
      {isVisible ? (
        <span
          role="tooltip"
          id={tooltipId}
          className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs text-ink-inverse shadow-overlay"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
