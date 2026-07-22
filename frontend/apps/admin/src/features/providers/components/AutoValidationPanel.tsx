import { AlertTriangle, CheckCircle2, ScanSearch } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { Pill } from "../../../components/ui/Pill";
import type { AutoValidationCheck } from "../applications.types";

export interface AutoValidationPanelProps {
  checks: readonly AutoValidationCheck[];
}

/**
 * The verdict sits directly under the evidence it was computed from, each check carrying a
 * StatusPill verdict. An OCR name mismatch is only judgeable if the scan is readable at the same
 * moment — which is why this decision belongs on desktop (spec §6.18).
 */
export function AutoValidationPanel({ checks }: AutoValidationPanelProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Card density="flush">
      <CardHeader
        icon={
          <IconChip accent="teal" look="soft">
            <ScanSearch aria-hidden />
          </IconChip>
        }
      >
        {t("review.autoValidation")}
      </CardHeader>
      <CardContent>
        <ul className="list-none">
          {checks.map((check) => (
            <li
              key={check.id}
              className="flex min-h-row-40 flex-wrap items-center gap-2 border-b border-border last:border-b-0"
            >
              <span className="min-w-0 grow py-2 text-sm text-ink">{t(check.labelKey)}</span>
              <Pill
                tone={check.passed ? "success" : "warning"}
                icon={check.passed ? CheckCircle2 : AlertTriangle}
              >
                {check.passed ? t("review.checkPassed") : t("review.checkFailed")}
              </Pill>
              {!check.passed && check.detail ? (
                <span className="w-full pb-2 text-xs text-warning-fg">{check.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
