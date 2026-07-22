import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../lib/cx";
import { Icon } from "../components/ui/Icon";

export interface MobileAppBarProps {
  title: string;
  /** Pushed screens show a back affordance; tab roots do not. */
  showBack?: boolean;
  /**
   * `close` for a full-screen modal task — cancel, refund, manual completion. The X says "abandon
   * this", where a chevron says "go up a level"; on a form that is about to spend money the
   * difference matters.
   */
  backIcon?: "back" | "close";
  /** Overrides browser-history back — use when the natural parent is not the previous screen. */
  onBack?: () => void;
  /** The smaller 18px title used on pushed detail screens. */
  compact?: boolean;
  /** Sits on the recessed grey canvas, matching the settings family. */
  onSurface?: boolean;
  bordered?: boolean;
  actions?: ReactNode;
}

/**
 * The mobile screen header. Sticky against `.screen__scroll`, so a screen can carry this, an alert
 * band and a bottom action bar simultaneously while its content scrolls between them.
 */
export function MobileAppBar({
  title,
  showBack = false,
  backIcon = "back",
  onBack,
  compact = false,
  onSurface = false,
  bordered = false,
  actions,
}: MobileAppBarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("adminShell");

  return (
    <header
      className={cx("appbar", bordered && "appbar--bordered", onSurface && "appbar--surface")}
    >
      {showBack ? (
        <button
          type="button"
          className="appbar__btn"
          onClick={onBack ?? (() => void navigate(-1))}
          aria-label={backIcon === "close" ? t("actions.close") : t("actions.back")}
        >
          <Icon glyph={backIcon === "close" ? X : ChevronLeft} size="lg" />
        </button>
      ) : null}
      <h1 className={cx("appbar__title", compact && "appbar__title--sm", "truncate")}>{title}</h1>
      {actions ? <div className="appbar__actions">{actions}</div> : null}
    </header>
  );
}
