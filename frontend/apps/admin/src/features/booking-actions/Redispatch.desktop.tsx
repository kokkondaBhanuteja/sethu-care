import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { SkeletonList } from "../../components/ui/Skeleton";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { RedispatchExhaustedBanner } from "./RedispatchExhaustedBanner";
import { RedispatchForm } from "./RedispatchForm";
import { EXHAUSTED_DISPATCH_CYCLES } from "./booking-actions.constants";
import type { RedispatchState } from "./useRedispatch";

/**
 * BOX 29–30. A drawer, not a modal: the settings only mean something next to the three rounds that
 * already failed, and those live in the timeline behind. Dimming the record to configure a retry of
 * that record would hide the evidence the operator is reasoning from.
 */
export function RedispatchDesktop({ state }: { state: RedispatchState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;
  const isExhausted = (context?.failedCycles ?? 0) >= EXHAUSTED_DISPATCH_CYCLES;

  return (
    <>
      <Drawer
        isOpen
        title={t("redispatch.title")}
        onDismiss={state.requestExit}
        footer={
          <>
            <Button variant="text" size="section" onClick={state.requestExit}>
              {tShell("actions.cancel")}
            </Button>
            <Button
              variant={isExhausted ? "outlineBrand" : "primary"}
              size="section"
              isLoading={state.form.isSubmitting}
              onClick={() => void state.form.handleSubmit()}
            >
              {t("redispatch.rerun")}
            </Button>
          </>
        }
      >
        {context ? (
          <p className="text-label text-text-2">
            {t("redispatch.subtitle", {
              reference: context.booking.reference,
              service: context.booking.serviceName,
              zone: context.booking.zone,
            })}
          </p>
        ) : null}

        {isExhausted ? <RedispatchExhaustedBanner bookingId={state.bookingId} /> : null}

        <QueryBoundary
          query={state.query}
          skeleton={
            <SkeletonList rows={4} rowClassName="h-row-56" label={t("redispatch.loading")} />
          }
        >
          {(data) => <RedispatchForm context={data} state={state} />}
        </QueryBoundary>
      </Drawer>

      <DiscardChangesPrompt
        isOpen={state.discard.isPrompting}
        isDesktop
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
