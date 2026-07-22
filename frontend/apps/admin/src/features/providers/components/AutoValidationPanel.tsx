import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { cx } from "../../../lib/cx";
import type { AutoValidationCheck } from "../applications.types";

export interface AutoValidationPanelProps {
  checks: readonly AutoValidationCheck[];
}

/**
 * The verdict sits directly under the evidence it was computed from. An OCR name mismatch is only
 * judgeable if the scan is readable at the same moment — which is why this decision belongs on
 * desktop (spec §6.18).
 */
export function AutoValidationPanel({ checks }: AutoValidationPanelProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Panel title={t("review.autoValidation")}>
      <ul className="list-none px-s4 py-s1">
        {checks.map((check) => (
          <li key={check.id} className="flex min-h-row-40 items-center gap-s2">
            <Icon
              glyph={check.passed ? CheckCircle2 : AlertTriangle}
              className={check.passed ? "text-success" : "text-warning"}
            />
            <span
              className={cx(
                "text-label",
                check.passed ? "text-text-1" : "font-semibold text-warning",
              )}
            >
              {check.passed
                ? t("review.checkLine", {
                    label: t(check.labelKey),
                    verdict: t("review.checkPassed"),
                  })
                : t("review.checkLineFailed", {
                    label: t(check.labelKey),
                    verdict: t("review.checkFailed"),
                    detail: check.detail ?? "",
                  })}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
