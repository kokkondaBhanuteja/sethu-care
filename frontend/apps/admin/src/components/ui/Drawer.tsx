import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Icon } from "./Icon";

export interface DrawerProps {
  isOpen: boolean;
  title: string;
  /** 400px for filters and settings-shaped work; 480px (default) for a record side panel. */
  width?: "narrow" | "default";
  footer?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * A right-hand panel for settings-shaped work that must not hide the record it acts on — filters,
 * audit-entry detail, a provider's documents. Desktop only; the mobile equivalent is a Sheet.
 */
export function Drawer({
  isOpen,
  title,
  width = "default",
  footer,
  onDismiss,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { t } = useTranslation("adminShell");

  useFocusTrap(panelRef, isOpen, onDismiss);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-scrim" onClick={onDismiss} role="presentation" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx("drawer", width === "narrow" && "drawer--400")}
      >
        <div className="drawer__head">
          <span className="t-section w-semi c-1 grow" id={titleId}>
            {title}
          </span>
          <button
            type="button"
            className="appbar__btn"
            onClick={onDismiss}
            aria-label={t("actions.close")}
          >
            <Icon glyph={X} size="lg" />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </aside>
    </>
  );
}
