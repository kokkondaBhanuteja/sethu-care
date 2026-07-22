import { useState } from "react";
import { TriangleAlert, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Banner } from "../../components/ui/Banner";
import { CardList } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { FilteredEmptyState } from "../../components/ui/states/FilteredEmptyState";
import { AssignBlockedOffline, AssignNoCandidates } from "./AssignEmptyStates";
import { AssignCandidateCard } from "./AssignCandidateCard";
import { AssignConfirmSheet } from "./AssignConfirmSheet";
import { BookingContextStrip } from "./BookingContextStrip";
import { MobileActionScreen } from "./MobileActionScreen";
import { useAssignFilters } from "./useAssignFilters";
import type { AssignProviderState } from "./useAssignProvider";

const TAB_VALUES = { recommended: "recommended", all: "all" } as const;
type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

/**
 * BOX 14–20. The ranking line under the tabs is the honest framing: these are ranked by the SAME
 * model auto-dispatch just failed with, so the operator is not getting a second opinion — they are
 * getting the same list plus their judgement.
 */
export function AssignProviderMobile({ state }: { state: AssignProviderState }) {
  const { t } = useTranslation("adminBookingActions");
  const filters = useAssignFilters();
  const [tab, setTab] = useState<TabValue>(TAB_VALUES.recommended);
  const booking = state.query.data?.booking;

  return (
    <>
      <MobileActionScreen
        title={t("assign.title")}
        {...(booking ? { reference: booking.reference } : {})}
        onClose={state.close}
        aboveScroll={
          <>
            {state.isBlockedOffline ? (
              <Banner tone="warning" icon={WifiOff} title={t("assign.offlineBanner")} />
            ) : null}
            <BookingContextStrip
              text={t("assign.contextStrip", {
                service: booking?.serviceName ?? "",
                zone: booking?.zone ?? "",
                minutes: booking?.escalatedMinutes ?? 0,
              })}
            />
            {/* An "All providers" tab that cannot produce providers is a promise the screen
                cannot keep, so the tabs go with the list when the connection does. */}
            {state.isBlockedOffline ? null : (
              <Tabs
                label={t("assign.tabsLabel")}
                variant="fill"
                value={tab}
                onValueChange={setTab}
                items={[
                  { value: TAB_VALUES.recommended, label: t("assign.tabRecommended") },
                  { value: TAB_VALUES.all, label: t("assign.tabAll") },
                ]}
              />
            )}
          </>
        }
        footer={
          state.isBlockedOffline ? undefined : (
            <span className="flex items-center gap-s2 text-label text-warning">
              <Icon glyph={TriangleAlert} className="text-warning" />
              {t("assign.declinedFooter", { count: state.query.data?.declinedCount ?? 0 })}
            </span>
          )
        }
      >
        {state.isBlockedOffline ? (
          <AssignBlockedOffline />
        ) : (
          <QueryBoundary
            query={state.query}
            skeleton={<SkeletonList rows={4} rowClassName="h-row-72" label={t("assign.loading")} />}
          >
            {(data) => {
              const candidates =
                tab === TAB_VALUES.recommended ? filters.apply(data.candidates) : data.candidates;

              if (candidates.length === 0 && data.candidates.length > 0) {
                // Empty-because-filtered, not a dead end: the "no providers online" copy over a
                // hidden list reads as a bug (§4.10).
                return <FilteredEmptyState onClearFilters={filters.clear} grow />;
              }
              if (candidates.length === 0) {
                return <AssignNoCandidates bookingId={state.bookingId} stacked />;
              }

              return (
                <div className="px-s4 pt-s3">
                  {tab === TAB_VALUES.recommended ? (
                    <p className="mb-s3 text-caption text-text-3">{t("assign.rankingHint")}</p>
                  ) : null}
                  <CardList>
                    {candidates.map((candidate) => (
                      <AssignCandidateCard
                        key={candidate.providerId}
                        candidate={candidate}
                        onSelect={state.select}
                        submittingProviderId={state.submittingProviderId}
                        isSubmitting={state.isSubmitting}
                      />
                    ))}
                  </CardList>
                </div>
              );
            }}
          </QueryBoundary>
        )}
      </MobileActionScreen>

      {booking && state.selected ? (
        <AssignConfirmSheet
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
