import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonList } from "../../components/ui/Skeleton";
import { formatMoney } from "../../lib/format";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { RedispatchExhaustedBanner } from "./RedispatchExhaustedBanner";
import { RedispatchForm } from "./RedispatchForm";
import { EXHAUSTED_DISPATCH_CYCLES } from "./booking-actions.constants";
import { rupeesToPaise } from "./booking-actions.money";
import type { RedispatchState } from "./useRedispatch";

/**
 * BOX 48–51. A sheet over the booking detail, for the same reason desktop uses a drawer: the
 * previous rounds behind it are what make the radius and the incentive legible.
 */
export function RedispatchMobile({ state }: { state: RedispatchState }) {
  const { t } = useTranslation("adminBookingActions");
  const context = state.query.data;
  const isExhausted = (context?.failedCycles ?? 0) >= EXHAUSTED_DISPATCH_CYCLES;
  const incentiveRupees = state.form.form.watch("incentiveRupees");
  // The commit button carries the cost the operator has set — money never leaves silently.
  const rerunLabel =
    incentiveRupees > 0
      ? t("redispatch.rerunWithCost", { amount: formatMoney(rupeesToPaise(incentiveRupees)) })
      : t("redispatch.rerun");

  return (
    <>
      <Sheet
        isOpen
        title={t("redispatch.title")}
        onDismiss={state.requestExit}
        footer={
          <Button
            variant={isExhausted ? "outlineBrand" : "primary"}
            size="primary"
            block
            isLoading={state.form.isSubmitting}
            onClick={() => void state.form.handleSubmit()}
          >
            {rerunLabel}
          </Button>
        }
      >
        <div className="flex flex-col gap-s3">
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
        </div>
      </Sheet>

      <DiscardChangesPrompt
        isOpen={state.discard.isPrompting}
        isDesktop={false}
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
