import { useTranslation } from "@sethu/i18n";

import { SelectInput, type SelectOption } from "../../components/ui/form/SelectInput";
import { TextInput } from "../../components/ui/form/TextInput";
import { ACTION_LABEL_KEYS, RANGE_LABEL_KEYS, TARGET_TYPE_LABEL_KEYS } from "./audit.constants";
import {
  AUDIT_ACTIONS,
  AUDIT_RANGES,
  AUDIT_TARGET_TYPES,
  type AuditAction,
  type AuditAdmin,
  type AuditFilters,
  type AuditRange,
  type AuditTargetType,
} from "./audit.types";

export interface AuditFilterFieldsProps {
  filters: AuditFilters;
  admins: readonly AuditAdmin[];
  onChange: (patch: Partial<AuditFilters>) => void;
  /** `inline` sits in the desktop filter bar; `stack` fills the mobile Sheet. */
  layout?: "stack" | "inline";
}

/**
 * The full filter set (spec §6.29): admin, action type, target type, date range. Shared by the
 * desktop filter band (inline) and the mobile Sheet so the two surfaces cannot drift apart.
 *
 * Dates are native `type="date"` inputs. The design specifies no custom calendar anywhere in this
 * product, and the platform picker is keyboard- and screen-reader-complete already.
 */
export function AuditFilterFields({
  filters,
  admins,
  onChange,
  layout = "stack",
}: AuditFilterFieldsProps) {
  const { t } = useTranslation("adminAudit");

  const adminOptions: readonly SelectOption[] = [
    { value: "", label: t("filters.allAdmins") },
    ...admins.map((admin) => ({ value: admin.id, label: admin.name })),
  ];

  const actionOptions: readonly SelectOption[] = [
    { value: "", label: t("filters.allActions") },
    ...Object.values(AUDIT_ACTIONS).map((action) => ({
      value: action,
      label: t(ACTION_LABEL_KEYS[action]),
    })),
  ];

  const targetOptions: readonly SelectOption[] = [
    { value: "", label: t("filters.allTargets") },
    ...Object.values(AUDIT_TARGET_TYPES).map((targetType) => ({
      value: targetType,
      label: t(TARGET_TYPE_LABEL_KEYS[targetType]),
    })),
  ];

  const rangeOptions: readonly SelectOption[] = Object.values(AUDIT_RANGES).map((range) => ({
    value: range,
    label: t(RANGE_LABEL_KEYS[range]),
  }));

  return (
    <div
      className={layout === "inline" ? "flex flex-wrap items-end gap-s3" : "flex flex-col gap-s3"}
    >
      <SelectInput
        label={t("filters.admin")}
        options={adminOptions}
        value={filters.adminId ?? ""}
        onChange={(event) => onChange({ adminId: event.target.value || null })}
      />
      <SelectInput
        label={t("filters.action")}
        options={actionOptions}
        value={filters.action ?? ""}
        onChange={(event) => onChange({ action: toAction(event.target.value) })}
      />
      <SelectInput
        label={t("filters.target")}
        options={targetOptions}
        value={filters.targetType ?? ""}
        onChange={(event) => onChange({ targetType: toTargetType(event.target.value) })}
      />
      <SelectInput
        label={t("filters.range")}
        options={rangeOptions}
        value={filters.range}
        onChange={(event) => onChange({ range: toRange(event.target.value) })}
      />

      {filters.range === AUDIT_RANGES.custom ? (
        <div className="flex gap-s3">
          <div className="flex-1">
            <TextInput
              label={t("filters.from")}
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ from: event.target.value || null })}
            />
          </div>
          <div className="flex-1">
            <TextInput
              label={t("filters.to")}
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ to: event.target.value || null })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// A native <select> hands back a string. These narrow it against the vocabulary rather than
// trusting the DOM value, so an unrecognised option clears the filter instead of poisoning it.
function toAction(value: string): AuditAction | null {
  return Object.values(AUDIT_ACTIONS).find((action) => action === value) ?? null;
}

function toTargetType(value: string): AuditTargetType | null {
  return Object.values(AUDIT_TARGET_TYPES).find((targetType) => targetType === value) ?? null;
}

function toRange(value: string): AuditRange {
  return Object.values(AUDIT_RANGES).find((range) => range === value) ?? AUDIT_RANGES.last7;
}
