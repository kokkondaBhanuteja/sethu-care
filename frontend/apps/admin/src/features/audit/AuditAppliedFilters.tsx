import { useTranslation } from "@sethu/i18n";

import { AppliedFilter } from "../../components/ui/FilterBar";
import { formatDateShort } from "../../lib/format";
import {
  ACTION_LABEL_KEYS,
  AUDIT_DEFAULT_FILTERS,
  RANGE_LABEL_KEYS,
  TARGET_TYPE_LABEL_KEYS,
} from "./audit.constants";
import type { AuditAdmin, AuditFilters, AuditPage } from "./audit.types";

export interface AuditAppliedFiltersProps {
  filters: AuditFilters;
  admins: readonly AuditAdmin[];
  page: AuditPage | undefined;
  onChange: (patch: Partial<AuditFilters>) => void;
}

/**
 * What is currently being hidden, stated plainly. On a ledger "what am I actually looking at?" has
 * to be answerable without reopening four selects — a filtered audit log that reads as unfiltered
 * is a way to reach a wrong conclusion (BOX 49/77). The count is part of the claim.
 */
export function AuditAppliedFilters({ filters, admins, page, onChange }: AuditAppliedFiltersProps) {
  const { t } = useTranslation("adminAudit");
  const adminName = admins.find((admin) => admin.id === filters.adminId)?.name ?? filters.adminId;

  const chips = [
    filters.search.trim()
      ? {
          id: "search",
          label: t("filters.appliedSearch", { value: filters.search.trim() }),
          patch: { search: "" },
        }
      : null,
    filters.adminId
      ? {
          id: "admin",
          label: t("filters.appliedAdmin", { value: adminName }),
          patch: { adminId: null },
        }
      : null,
    filters.action
      ? {
          id: "action",
          label: t("filters.appliedAction", { value: t(ACTION_LABEL_KEYS[filters.action]) }),
          patch: { action: null },
        }
      : null,
    filters.targetType
      ? {
          id: "target",
          label: t("filters.appliedTarget", {
            value: t(TARGET_TYPE_LABEL_KEYS[filters.targetType]),
          }),
          patch: { targetType: null },
        }
      : null,
    filters.range !== AUDIT_DEFAULT_FILTERS.range
      ? {
          id: "range",
          label: t("filters.appliedRange", { value: t(RANGE_LABEL_KEYS[filters.range]) }),
          patch: { range: AUDIT_DEFAULT_FILTERS.range, from: null, to: null },
        }
      : null,
  ].filter((chip) => chip !== null);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-s2">
      {chips.map((chip) => (
        <AppliedFilter
          key={chip.id}
          label={chip.label}
          onRemove={() => onChange(chip.patch)}
          removeLabel={t("filters.remove", { value: chip.label })}
        />
      ))}
      {page ? (
        <span className="text-caption text-text-3" aria-live="polite">
          {t("filters.resultCount", { count: page.total })}
          {page.rangeFrom && page.rangeTo
            ? ` · ${formatDateShort(page.rangeFrom)} – ${formatDateShort(page.rangeTo)}`
            : null}
        </span>
      ) : null}
    </div>
  );
}
