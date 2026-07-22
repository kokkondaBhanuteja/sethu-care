import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SkeletonList } from "../../components/ui/Skeleton";
import { FilteredEmptyState } from "../../components/ui/states/FilteredEmptyState";
import { Switch } from "../../components/ui/form/Switch";
import { AssignBlockedOffline, AssignNoCandidates } from "./AssignEmptyStates";
import { AssignCandidateTable } from "./AssignCandidateTable";
import { AssignConfirmDialog } from "./AssignConfirmDialog";
import { AssignRankingPanel } from "./AssignRankingPanel";
import { useAssignFilters } from "./useAssignFilters";
import type { AssignProviderState } from "./useAssignProvider";

export interface AssignProviderDesktopProps {
  state: AssignProviderState;
}

/**
 * BOX 10–12. A centred modal rather than a drawer: assigning wants the whole record out of the way
 * but not out of mind, so the escalated booking stays visible behind the scrim and the modal
 * carries its id in the subtitle. The filters govern the list, so they sit with the list — not in
 * the footer beside Cancel. A row's Assign never commits: it opens the same confirm step mobile
 * shows (ETA, notifications, the on-job warning) via `AssignConfirmDialog`.
 */
export function AssignProviderDesktop({ state }: AssignProviderDesktopProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const filters = useAssignFilters();
  const booking = state.query.data?.booking;

  return (
    <>
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
          <Button variant="text" size="inline" onClick={state.close}>
            {tShell("actions.cancel")}
          </Button>
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
                <div className="flex flex-col gap-s4">
                  <div className="flex flex-wrap items-center gap-s5">
                    <Switch
                      checked={filters.skillMatchOnly}
                      onCheckedChange={filters.setSkillMatchOnly}
                      label={t("assign.filterSkillOnly")}
                    />
                    <Switch
                      checked={filters.availableNowOnly}
                      onCheckedChange={filters.setAvailableNowOnly}
                      label={t("assign.filterAvailableOnly")}
                    />
                  </div>

                  {candidates.length === 0 && data.candidates.length > 0 ? (
                    // Empty-because-filtered is a different fact from "no providers online", and
                    // the design's dead-end copy would read as a bug over a hidden list (§4.10).
                    <FilteredEmptyState onClearFilters={filters.clear} />
                  ) : candidates.length === 0 ? (
                    <AssignNoCandidates bookingId={state.bookingId} />
                  ) : (
                    <AssignCandidateTable
                      candidates={candidates}
                      onSelect={state.select}
                      isSubmitting={state.isSubmitting}
                    />
                  )}

                  <AssignRankingPanel
                    weights={data.rankingWeights}
                    rounds={data.rounds}
                    declinedCount={data.declinedCount}
                    defaultOpen={data.candidates.length === 0}
                  />
                </div>
              );
            }}
          </QueryBoundary>
        )}
      </Modal>

      {booking ? (
        <AssignConfirmDialog
          candidate={state.selected}
          booking={booking}
          isSubmitting={state.isSubmitting}
          onConfirm={() => {
            if (state.selected) state.assign(state.selected);
          }}
          onDismiss={state.clearSelection}
        />
      ) : null}
    </>
  );
}
