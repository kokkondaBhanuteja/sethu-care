import type { ReactNode } from "react";
import { ChevronRight, SquareArrowOutUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { cx } from "../../lib/cx";
import { Icon } from "../../components/ui/Icon";

export const SETTINGS_ROW_HEIGHTS = {
  compact: "min-h-row-48",
  default: "min-h-row-52",
  list: "min-h-row-56",
  detail: "min-h-row-60",
  record: "min-h-row-72",
} as const;

export type SettingsRowHeight = keyof typeof SETTINGS_ROW_HEIGHTS;

export interface SettingsRowProps {
  icon?: LucideIcon;
  /** A composed leading visual (an identity chip) where a bare glyph is not enough. */
  leading?: ReactNode;
  label: ReactNode;
  /** The consequence or the qualifier, under the label. */
  detail?: ReactNode;
  /** A read-only value shown before the trailing affordance. */
  value?: ReactNode;
  /** The trailing control — a switch, a pill, a lock, an inline button. */
  control?: ReactNode;
  height?: SettingsRowHeight;
  /** Renders as a link. `external` swaps the chevron for a link-out arrow (spec §6.22). */
  to?: string;
  external?: boolean;
  onClick?: () => void;
  /** Overrides the trailing affordance an interactive row would otherwise draw. */
  affordance?: "auto" | "none";
  /** Destructive rows (Sign out, Sign out everywhere) carry the danger ink, not an icon. */
  tone?: "default" | "danger";
  /** The Sign-out row is the action, not a route to one, so it centres and drops its chevron. */
  centered?: boolean;
  className?: string;
}

const BASE_ROW = "flex w-full items-center gap-s3 px-s4 py-s2 text-left";
const DIVIDER = "border-t border-border-subtle first:border-t-0";

/**
 * One row of a settings card. Rows are separated by an inset divider rather than a gap, so a group
 * reads as one object; `first:` drops the divider on the leading row without any index arithmetic.
 */
export function SettingsRow({
  icon,
  leading,
  label,
  detail,
  value,
  control,
  height = "default",
  to,
  external = false,
  onClick,
  affordance = "auto",
  tone = "default",
  centered = false,
  className,
}: SettingsRowProps) {
  const isNavigable = to !== undefined;
  const isInteractive = isNavigable || onClick !== undefined;
  const showsAffordance = isInteractive && !centered && affordance !== "none";

  const body = (
    <>
      {leading}
      {icon ? <Icon glyph={icon} size="nav" className="text-text-2" /> : null}
      <span className={cx("min-w-0", centered ? "" : "grow")}>
        <span className={cx("block text-body", tone === "danger" ? "text-danger" : "text-text-1")}>
          {label}
        </span>
        {detail ? <span className="block text-caption text-text-3">{detail}</span> : null}
      </span>
      {value !== undefined ? (
        <span className="shrink-0 text-label text-text-3">{value}</span>
      ) : null}
      {control}
      {showsAffordance ? (
        <Icon
          glyph={external ? SquareArrowOutUpRight : ChevronRight}
          size={external ? "sm" : "md"}
          className="shrink-0 text-text-3"
        />
      ) : null}
    </>
  );

  const rowClassName = cx(
    BASE_ROW,
    DIVIDER,
    SETTINGS_ROW_HEIGHTS[height],
    centered && "justify-center",
    className,
  );

  if (isNavigable) {
    return (
      <Link to={to} className={rowClassName}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={rowClassName} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}
