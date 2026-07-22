import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";

export interface SettingsGroupProps {
  /** The small uppercase header above the card. Omitted on ungrouped cards (the profile row). */
  title?: string;
  /** A small glyph before the title — what makes each card scannable by shape, not only by word. */
  icon?: LucideIcon;
  /** The critical-notification group is the only one whose header is red (spec §6.30). */
  tone?: "default" | "danger";
  /** One line under the header saying what the group holds, before the rows say it in detail. */
  description?: ReactNode;
  /** A line under the card that is about the group, not about any one row. */
  foot?: ReactNode;
  footTone?: "default" | "warning";
  children: ReactNode;
  className?: string;
}

/**
 * One block of the settings family: a small uppercase header, a white card floating on the recessed
 * grey canvas, and an optional footnote. Every settings screen on both surfaces is built from these,
 * which is what keeps More, Notifications, Security, Profile and Help visually one thing.
 */
export function SettingsGroup({
  title,
  icon,
  tone = "default",
  description,
  foot,
  footTone = "default",
  children,
  className,
}: SettingsGroupProps) {
  return (
    <section className={cx("mb-s5 flex flex-col gap-s2 px-s4", className)}>
      {title ? (
        <h2
          className={cx(
            "flex items-center gap-s2 px-s1 text-pill uppercase tracking-wider",
            tone === "danger" ? "text-danger" : "text-text-3",
          )}
        >
          {icon ? <Icon glyph={icon} size="sm" /> : null}
          {title}
        </h2>
      ) : null}
      {description ? <p className="px-s1 text-caption text-text-3">{description}</p> : null}
      {children}
      {foot ? (
        <p
          className={cx(
            "px-s1 text-caption",
            footTone === "warning" ? "text-warning" : "text-text-3",
          )}
        >
          {foot}
        </p>
      ) : null}
    </section>
  );
}

export interface SettingsCardProps {
  /** The critical tier is tinted and outlined so it reads as structurally different (BOX 60/97). */
  tone?: "default" | "danger";
  /** Desktop-only destinations render a full step lighter — a warning before the tap, not after. */
  muted?: boolean;
  children: ReactNode;
  className?: string;
}

export function SettingsCard({
  tone = "default",
  muted = false,
  children,
  className,
}: SettingsCardProps) {
  return (
    <Card
      density="flush"
      tone={tone === "danger" ? "tintDanger" : "plain"}
      edge={tone === "danger" ? "danger" : "none"}
      className={cx("overflow-hidden", muted && "text-text-3", className)}
    >
      {children}
    </Card>
  );
}

export interface SettingsNoteProps {
  children: ReactNode;
  className?: string;
}

/** A note inside the card, under the last row — the explanation the rows above it raise. */
export function SettingsNote({ children, className }: SettingsNoteProps) {
  return (
    <p
      className={cx(
        "border-t border-border-subtle px-s4 pt-s2 pb-s3 text-caption text-text-2",
        className,
      )}
    >
      {children}
    </p>
  );
}

export interface SettingsLeadProps {
  children: ReactNode;
}

/**
 * The one-line statement of what a settings screen holds, straight under the mobile app bar. The
 * desktop frame carries the same line in its section header (`SettingsShell`); this is the phone's
 * room-sized version of it.
 */
export function SettingsLead({ children }: SettingsLeadProps) {
  return <p className="mx-s4 px-s1 pb-s2 pt-s1 text-caption text-text-2">{children}</p>;
}
