import { useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { Icon } from "../../components/ui/Icon";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SUPPORT_FAQ_IDS } from "./settings.constants";

/**
 * BOX 65 / 104 — the common questions (spec §6.33). Answers expand in place rather than pushing the
 * admin to a sub-page: someone stuck mid-escalation is reading this one-handed, and a navigation
 * step costs more than the vertical space the open answer takes.
 */
export function HelpFaqGroup() {
  const { t } = useTranslation("adminSettings");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <SettingsGroup title={t("support.groupQuestions")} icon={CircleHelp}>
      <SettingsCard>
        {SUPPORT_FAQ_IDS.map((faqId) => {
          const isOpen = openId === faqId;
          return (
            <div key={faqId} className="border-t border-border-subtle first:border-t-0">
              <button
                type="button"
                className="flex min-h-row-56 w-full items-center gap-s3 px-s4 py-s2 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : faqId)}
              >
                <Icon glyph={CircleHelp} size="nav" className="text-text-3" />
                <span className="grow text-body text-text-1">{t(`support.faq.${faqId}Q`)}</span>
                <Icon
                  glyph={ChevronDown}
                  className={cx("shrink-0 text-text-3", isOpen && "rotate-180")}
                />
              </button>
              {isOpen ? (
                <p className="px-s4 pb-s3 text-label text-text-2">{t(`support.faq.${faqId}A`)}</p>
              ) : null}
            </div>
          );
        })}
      </SettingsCard>
    </SettingsGroup>
  );
}
