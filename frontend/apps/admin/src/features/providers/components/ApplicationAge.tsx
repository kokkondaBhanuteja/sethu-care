import { Clock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../../components/ui/Pill";
import { cx } from "../../../lib/cx";
import { ProgressMeter } from "./ProgressMeter";

/** > 5 days is red, > 2 amber, otherwise neutral (spec §6.17). The number is always shown. */
export function ApplicationAgePill({ days, onTint = false }: { days: number; onTint?: boolean }) {
  const { t } = useTranslation("adminProviders");
  const tone = days > 5 ? "danger" : days > 2 ? "warning" : "neutral";

  return (
    <Pill tone={tone} icon={Clock} onTint={onTint}>
      {t("applications.waitingDays", { count: days })}
    </Pill>
  );
}

export interface DocumentCompletenessProps {
  present: number;
  required: number;
  /** The queue table puts the fraction beside the bar; the mobile card puts it above. */
  layout: "inline" | "stacked";
}

/** Completeness as a fraction AND a bar: the bar alone would be a colour carrying the meaning. */
export function DocumentCompleteness({ present, required, layout }: DocumentCompletenessProps) {
  const { t } = useTranslation("adminProviders");
  const isComplete = present >= required;
  const label = t("applications.documentProgressLabel", { present, required });

  if (layout === "inline") {
    return (
      <span className="flex items-center gap-s2">
        <span
          className={cx(
            "flex-none text-label tabular-nums",
            isComplete ? "text-success" : "text-warning",
          )}
        >
          {t("applications.documentsOf", { present, required })}
        </span>
        <ProgressMeter present={present} required={required} label={label} className="w-row-72" />
      </span>
    );
  }

  return (
    <span className="block">
      <span className={cx("text-caption", isComplete ? "text-success" : "text-warning")}>
        {t("applications.documentsCount", { present, required })}
      </span>
      <ProgressMeter present={present} required={required} label={label} className="mt-s2" />
    </span>
  );
}
