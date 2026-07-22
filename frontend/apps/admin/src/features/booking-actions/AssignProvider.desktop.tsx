import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Switch } from "../../components/ui/form/Switch";
import { AssignBlockedOffline, AssignNoCandidates } from "./AssignEmptyStates";
import { AssignCandidateTable } from "./AssignCandidateTable";
import { AssignRankingPanel } from "./AssignRankingPanel";
import { useAssignFilters } from "./useAssignFilters";
import type { AssignProviderState } from "./useAssignProvider";

export interface AssignProviderDesktopProps {
  state: AssignProviderState;
}

/**
 * BOX 10–12. A centred modal rather than a drawer: assigning wants the whole record out of the way
 * but not out of mind, so the escalated booking stays visible behind the scrim and the modal
 * carries its id in the subtitle. The explainer panel survives the empty state on purpose — "no
 * providers" is a claim, and the weights plus the exhausted rounds beside it are its evidence.
 */
export function AssignProviderDesktop({ state }: AssignProviderDesktopProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const filters = useAssignFilters();
  const booking = state.query.data?.booking;

  return (
    <Modal
      isOpen
      width="wide"
      title={t("assign.title")}
      subtitle={
        booking
          ? t("assign.subtitle", {
              reference: booking.reference,
              service: booking.serviceName,
              zone: booking.zone,
              minutes: booking.escalatedMinutes ?? 0,
            })
          : undefined
      }
      isDismissable={!state.isSubmitting}
      onDismiss={state.close}
      footer={
        <>
          <Switch
            checked={filters.skillMatchOnly}
            disabled={state.isBlockedOffline}
            onCheckedChange={filters.setSkillMatchOnly}
            label={t("assign.filterSkillOnly")}
          />
          <Switch
            checked={filters.availableNowOnly}
            disabled={state.isBlockedOffline}
            onCheckedChange={filters.setAvailableNowOnly}
            label={t("assign.filterAvailableOnly")}
          />
          <Button variant="text" size="inline" onClick={state.close}>
            {tShell("actions.cancel")}
          </Button>
        </>
      }
    >
      {state.isBlockedOffline ? (
        <AssignBlockedOffline />
      ) : (
        <QueryBoundary
          query={state.query}
          skeleton={<SkeletonList rows={4} rowClassName="h-row-60" label={t("assign.loading")} />}
        >
          {(data) => {
            const candidates = filters.apply(data.candidates);
            return (
              <div className="grid gap-s4 lg:grid-cols-4">
                <div className="min-w-0 lg:col-span-3">
                  {candidates.length === 0 ? (
                    <AssignNoCandidates bookingId={state.bookingId} />
                  ) : (
                    <AssignCandidateTable
                      candidates={candidates}
                      onSelect={state.assign}
                      isSubmitting={state.isSubmitting}
                    />
                  )}
                </div>
                <AssignRankingPanel
                  weights={data.rankingWeights}
                  rounds={data.rounds}
                  declinedCount={data.declinedCount}
                />
              </div>
            );
          }}
        </QueryBoundary>
      )}
    </Modal>
  );
}
