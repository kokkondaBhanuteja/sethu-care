import { Download, Landmark } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Topbar } from "../../layouts/Topbar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiTile } from "../../components/ui/KpiTile";
import { Panel } from "../../components/ui/Panel";
import { SkeletonList } from "../../components/ui/Skeleton";
import { formatDate, formatMoneyCompact } from "../../lib/format";
import { PayoutsTable } from "./PayoutsTable";
import { PayoutTotals } from "./PayoutTotals";
import { formatClockTime } from "./settings.time";
import { usePayouts } from "./usePayouts";

/**
 * BOX 66 — the one genuinely desktop-only screen (spec §1.5). Export CSV belongs here because this
 * is a finance surface that feeds a bank file, unlike the audit log, which is append-only and
 * carries no export at all.
 */
export function PayoutsScreen() {
  const { t } = useTranslation("adminSettings");
  const query = usePayouts();

  return (
    <>
      <Topbar title={t("payouts.title")} />

      <main className="main">
        <QueryBoundary
          query={query}
          skeleton={<SkeletonList rows={8} label={t("payouts.loading")} />}
          isEmpty={(cycle) => cycle.rows.length === 0}
          empty={
            <EmptyState
              icon={Landmark}
              title={t("payouts.emptyTitle")}
              body={t("payouts.emptyBody")}
              grow
            />
          }
        >
          {(cycle) => (
            <>
              <div className="kpi-row mb-s5">
                <KpiTile
                  label={t("payouts.kpiPending")}
                  value={formatMoneyCompact(cycle.pendingPaise)}
                />
                <KpiTile
                  label={t("payouts.kpiAwaiting")}
                  value={String(cycle.providersAwaiting)}
                />
                <KpiTile
                  label={t("payouts.kpiNextRun")}
                  value={formatDate(cycle.nextRunIso)}
                />
                <KpiTile
                  label={t("payouts.kpiLastRun")}
                  value={formatMoneyCompact(cycle.lastRunPaise)}
                />
              </div>

              <p className="mb-s4 text-caption text-text-3">
                {t("payouts.kpiPendingFoot", { date: formatDate(cycle.cycleClosesIso) })} ·{" "}
                {t("payouts.kpiAwaitingFoot", { count: cycle.zones })} ·{" "}
                {t("payouts.kpiNextRunFoot", { time: formatClockTime(cycle.nextRunTime) })} ·{" "}
                {t("payouts.kpiLastRunFoot", {
                  date: formatDate(cycle.lastRunIso),
                  count: cycle.lastRunProviders,
                })}
              </p>

              <div className="mb-s4 flex justify-end gap-s2">
                <Button variant="outline" size="section" iconStart={Download}>
                  {t("payouts.exportCsv")}
                </Button>
                <Button variant="primary" size="section" iconStart={Landmark}>
                  {t("payouts.runCycle")}
                </Button>
              </div>

              <Panel
                flush
                footer={t("payouts.foot", {
                  shown: cycle.rows.length,
                  total: cycle.providersAwaiting,
                })}
              >
                <PayoutsTable rows={cycle.rows} />
                <PayoutTotals totals={cycle.totals} />
              </Panel>
            </>
          )}
        </QueryBoundary>
      </main>
    </>
  );
}
