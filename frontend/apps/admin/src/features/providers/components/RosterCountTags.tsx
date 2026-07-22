import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../../components/ui/Pill";
import type { RosterCounts } from "../providers.types";

export interface RosterCountTagsProps {
  counts: RosterCounts;
}

/**
 * The roster's shape at a glance. These are counts, not filters — nothing here is clickable, which
 * is why the design gives them the flat tag treatment rather than a chip an operator would try.
 */
export function RosterCountTags({ counts }: RosterCountTagsProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <div className="flex flex-wrap items-center gap-s2 px-s2 py-s4">
      <Pill tone="neutral">
        <span className="tabular-nums">{counts.total}</span> {t("roster.tagTotal")}
      </Pill>
      <Pill tone="success">
        <span className="tabular-nums">{counts.online}</span> {t("roster.tagOnline")}
      </Pill>
      <Pill tone="warning">
        <span className="tabular-nums">{counts.onJob}</span> {t("roster.tagOnJob")}
      </Pill>
      <Pill tone="danger">
        <span className="tabular-nums">{counts.suspended}</span> {t("roster.tagSuspended")}
      </Pill>
    </div>
  );
}
