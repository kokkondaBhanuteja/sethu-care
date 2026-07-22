import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { formatDate, formatMoneyCompact } from "../../lib/format";
import { PAYOUT_CYCLE } from "./settings.fixtures";
import { DESKTOP_SURFACES } from "./settings.constants";
import type { DesktopSurface } from "./settings.types";

interface SummaryRow {
  readonly labelKey: string;
  readonly value: string;
}

interface SummarySpec {
  readonly groupKey: string;
  readonly noteKey: string;
  readonly rows: readonly SummaryRow[];
}

/** The counts each surface's summary answers. Only payouts has live data today. */
function specFor(surface: DesktopSurface): SummarySpec {
  switch (surface) {
    case DESKTOP_SURFACES.payouts:
      return {
        groupKey: "desktopOnly.payoutsGroup",
        noteKey: "desktopOnly.payoutsNote",
        rows: [
          {
            labelKey: "desktopOnly.payoutsPending",
            value: formatMoneyCompact(PAYOUT_CYCLE.pendingPaise),
          },
          {
            labelKey: "desktopOnly.payoutsAwaiting",
            value: String(PAYOUT_CYCLE.providersAwaiting),
          },
          {
            labelKey: "desktopOnly.payoutsNextRun",
            value: formatDate(PAYOUT_CYCLE.nextRunIso),
          },
        ],
      };
    case DESKTOP_SURFACES.services:
      return {
        groupKey: "desktopOnly.servicesGroup",
        noteKey: "desktopOnly.servicesNote",
        rows: [
          { labelKey: "desktopOnly.servicesCategories", value: "8" },
          { labelKey: "desktopOnly.servicesActive", value: "34" },
          { labelKey: "desktopOnly.servicesLastChange", value: formatDate("2026-07-14") },
        ],
      };
    case DESKTOP_SURFACES.reports:
      return {
        groupKey: "desktopOnly.reportsGroup",
        noteKey: "desktopOnly.reportsNote",
        rows: [
          { labelKey: "desktopOnly.reportsBooking", value: "" },
          { labelKey: "desktopOnly.reportsUtilisation", value: "" },
          { labelKey: "desktopOnly.reportsRevenue", value: "" },
          { labelKey: "desktopOnly.reportsCancellation", value: "" },
        ],
      };
    case DESKTOP_SURFACES.platform:
      return {
        groupKey: "desktopOnly.platformGroup",
        noteKey: "desktopOnly.platformNote",
        rows: [
          { labelKey: "desktopOnly.platformLastModified", value: formatDate("2026-07-16") },
          { labelKey: "desktopOnly.platformModifiedBy", value: "Super Admin" },
          { labelKey: "desktopOnly.platformIntegrations", value: "4" },
        ],
      };
    default:
      return {
        groupKey: "desktopOnly.pricingGroup",
        noteKey: "desktopOnly.pricingNote",
        rows: [
          { labelKey: "desktopOnly.pricingRules", value: "12" },
          { labelKey: "desktopOnly.pricingSurge", value: "3" },
          { labelKey: "desktopOnly.pricingLastChange", value: formatDate("2026-07-14") },
        ],
      };
  }
}

export interface DesktopOnlySummaryProps {
  surface: DesktopSurface;
}

/**
 * BOX 105–109 — the read-only half of the "Best on desktop" notice (spec §6.34). A refusal screen
 * that refuses nothing: the admin came here for a number, so the number is here, and only the acts
 * that genuinely need a wide screen are withheld.
 *
 * Rendered through `SurfaceGuard`'s `summary` slot, above the notice it already draws.
 */
export function DesktopOnlySummary({ surface }: DesktopOnlySummaryProps) {
  const { t } = useTranslation("adminSettings");
  const spec = specFor(surface);

  return (
    <Card className="mb-s5">
      <p className="mb-s2 text-pill uppercase tracking-wider text-text-3">{t(spec.groupKey)}</p>
      <dl className="flex flex-col">
        {spec.rows.map((row) => (
          <div
            key={row.labelKey}
            className="flex min-h-row-52 items-center justify-between gap-s3 border-t border-border-subtle first:border-t-0"
          >
            <dt className="text-body text-text-1">{t(row.labelKey)}</dt>
            <dd className="font-mono text-card text-text-1">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-s3 text-caption text-text-3">{t(spec.noteKey)}</p>
    </Card>
  );
}
