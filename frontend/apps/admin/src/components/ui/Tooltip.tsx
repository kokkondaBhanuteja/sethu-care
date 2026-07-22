import { useId, useState, type ReactNode } from "react";

export interface TooltipProps {
  /** Short clarification. Anything longer belongs in the body copy, not a hover. */
  content: string;
  children: ReactNode;
}

/**
 * Supplementary detail on hover or focus. Not in the artifacts (they are static, so no hover state
 * was drawn), so it is built from the same tokens as the toast.
 *
 * Never the only carrier of meaning: tooltips are unreachable on touch, which is half this
 * console's surface area. Anything an operator must know is on the screen.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span aria-describedby={tooltipId}>{children}</span>
      {isVisible ? (
        <span role="tooltip" id={tooltipId} className="tooltip__bubble">
          {content}
        </span>
      ) : null}
    </span>
  );
}
