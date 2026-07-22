import type { ReactNode } from "react";
import { useTranslation } from "@sethu/i18n";
import { IconChip, PageHeader } from "@sethu/ui-web";

import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { cx } from "../../lib/cx";
import { SettingsSectionNav } from "./SettingsSectionNav";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settings.constants";
import { useSettingsCrumbs } from "./useSettingsCrumbs";

export interface SettingsShellProps {
  section: SettingsSectionId;
  /** The narrow explainer card floating right of the content (BOX 60). */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * The unified desktop Settings frame: one PageHeader ("Settings"), the left sub-nav highlighting
 * the active section, and that section's content as the reading column. The frame mounts per route
 * — /profile, /settings/notifications, /settings/security and /support all render it — so every
 * deep link keeps working and every section can reach every other in one click.
 *
 * Each section leads with its icon and a one-line statement of what lives in it, because "which of
 * these four places holds the thing I want?" was the confusion this frame exists to remove.
 */
export function SettingsShell({ section, aside, children }: SettingsShellProps) {
  const { t } = useTranslation("adminSettings");
  const active = SETTINGS_SECTIONS.find((candidate) => candidate.id === section);
  const crumbs = useSettingsCrumbs(active ? t(active.labelKey) : t("sections.title"));
  const ActiveGlyph = active?.icon;

  return (
    <>
      <Topbar crumbs={crumbs} pageRendersHeading />

      <PageMain>
        <PageHeader title={t("sections.title")} description={t("sections.lead")} />

        <div className="flex items-start gap-6">
          <SettingsSectionNav />

          <div className={cx("min-w-0 grow", aside ? "max-w-2xl" : "max-w-3xl")}>
            {active && ActiveGlyph ? (
              <header className="mb-s5 flex items-center gap-s3 px-s4">
                <IconChip accent="brand" look="soft" size="md">
                  <ActiveGlyph />
                </IconChip>
                <div className="min-w-0">
                  <h2 className="text-title text-text-1">{t(active.labelKey)}</h2>
                  <p className="text-label text-text-2">{t(active.descriptionKey)}</p>
                </div>
              </header>
            ) : null}
            {children}
          </div>

          {/* The explainer is an aside in the literal sense — below xl the reading column keeps
              the room and nothing required is lost. */}
          {aside ? <div className="hidden shrink-0 xl:block">{aside}</div> : null}
        </div>
      </PageMain>
    </>
  );
}
