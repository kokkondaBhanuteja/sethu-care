import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

export const BANNER_TONES = {
  danger: "banner--danger",
  warning: "banner--warning",
  success: "banner--success",
  info: "banner--info",
  /** The plain grey strip — a standing fact rather than a condition. The audit log's
   *  "this ledger cannot be edited" notice is the canonical use. */
  neutral: "",
} as const;

export type BannerTone = keyof typeof BANNER_TONES;

/** The banner's own text colour. Not derivable from the tone key — `neutral` has no `c-neutral`. */
const BANNER_TEXT_TONES: Readonly<Record<BannerTone, string>> = {
  danger: "c-danger",
  warning: "c-warning",
  success: "c-success",
  info: "c-info",
  neutral: "c-2",
};

const BANNER_ROLES: Readonly<Record<BannerTone, "alert" | "status" | undefined>> = {
  danger: "alert",
  warning: "status",
  success: "status",
  info: "status",
  neutral: undefined,
};

export interface BannerProps {
  tone: BannerTone;
  icon?: LucideIcon;
  /** The one-line headline. */
  title: ReactNode;
  /** Optional supporting line — the specific record, the age, the consequence. */
  detail?: ReactNode;
  /** Trailing affordance ("View all", "Retry"). */
  actions?: ReactNode;
  /** Sticks under the topbar while the condition holds — offline, stale, forced update (§3.3). */
  sticky?: boolean;
  /**
   * Full-bleed under the desktop topbar, at the 24px desktop gutter. The alert band on the Live
   * dashboard is the canonical use: it spans the whole content width rather than sitting inside it,
   * because it is a condition of the screen, not an item on it.
   */
  wide?: boolean;
  className?: string;
}

/**
 * A persistent condition the operator must know about. Banners are never dismissible while the
 * condition holds: an offline banner the user can close is an offline banner they will close.
 */
export function Banner({
  tone,
  icon,
  title,
  detail,
  actions,
  sticky = false,
  wide = false,
  className,
}: BannerProps) {
  return (
    <div
      // A neutral banner states a standing fact ("this ledger cannot be edited") and is present on
      // first paint, so it is not a live region — announcing it would interrupt for no news.
      role={BANNER_ROLES[tone]}
      className={cx(
        "banner",
        BANNER_TONES[tone],
        sticky && "banner--sticky",
        wide && "banner--wide",
        className,
      )}
    >
      {icon ? <Icon glyph={icon} className={BANNER_TEXT_TONES[tone]} /> : null}
      <div className="banner__body">
        <span className={cx("t-body w-semi", BANNER_TEXT_TONES[tone])}>{title}</span>
        {detail ? <span className="t-body c-1">{detail}</span> : null}
      </div>
      {actions ? <div className="banner__actions">{actions}</div> : null}
    </div>
  );
}
