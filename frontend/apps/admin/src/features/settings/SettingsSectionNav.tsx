import { NavLink } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { Icon } from "../../components/ui/Icon";
import { SETTINGS_SECTIONS } from "./settings.constants";

const LINK_BASE =
  "flex w-full items-center gap-s2 rounded-lg px-s3 py-s2 text-label transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The compact vertical sub-nav of the unified desktop Settings area: one pill per section, the
 * active one lifted to a white card on the grey canvas. `NavLink` sets `aria-current="page"` on the
 * active item, so the highlight is announced, not only painted.
 */
export function SettingsSectionNav() {
  const { t } = useTranslation("adminSettings");

  return (
    <nav aria-label={t("sections.navLabel")} className="w-56 shrink-0">
      <ul className="flex flex-col gap-s1">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.id}>
            <NavLink
              to={section.to}
              end
              className={({ isActive }) =>
                cx(
                  LINK_BASE,
                  isActive
                    ? "bg-surface font-medium text-text-1 shadow-card"
                    : "text-text-2 hover:bg-surface hover:text-text-1",
                )
              }
            >
              <Icon glyph={section.icon} size="nav" />
              {t(section.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
