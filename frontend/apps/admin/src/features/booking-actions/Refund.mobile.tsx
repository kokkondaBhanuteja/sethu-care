import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { SkeletonList } from "../../components/ui/Skeleton";
import { formatDate, formatMoney } from "../../lib/format";
import { BookingContextStrip } from "./BookingContextStrip";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { MobileActionScreen } from "./MobileActionScreen";
import { RefundForm } from "./RefundForm";
import { RefundPayoutChoice } from "./RefundPayoutChoice";
import { RefundRateLimited } from "./RefundRateLimited";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import type { RefundPayoutImpact } from "./booking-actions.constants";
import { refundLimits } from "./refundLimits";
import { refundCustomerMessage, refundSummaryLine } from "./refundSummary";
import type { RefundState } from "./useRefund";

/**
 * BOX 125–130. A money screen, so it is deliberately slow: type, amount, reason and payout impact
 * are all decided on one surface before a single confirm step. Nothing moves money from here — the
 * button reads "Continue to confirm".
 */
export function RefundMobile({ state }: { state: RefundState }) {
  const { t } = useTranslation("adminBookingActions");
  const context = state.query.data;
  const values = state.form.form.watch();
  const limits = refundLimits(context ?? null, values.refundType, values.amountRupees);

  return (
    <>
      <MobileActionScreen
        title={t("refund.title")}
        {...(context ? { reference: context.booking.reference } : {})}
        onClose={state.requestExit}
        aboveScroll={
          context ? (
            <BookingContextStrip
              text={t("refund.contextStrip", {
                service: context.booking.serviceName,
                customer: context.booking.customerName,
                amount: formatMoney(context.bookingValuePaise),
                method: context.originalMethodLabel,
                date: formatDate(context.paidAtIso),
              })}
            />
          ) : undefined
        }
        footer={
          <Button
            variant="primary"
            size="primary"
            block
            disabled={limits.isBlocked}
            isLoading={state.form.isSubmitting}
            onClick={() => void state.form.handleSubmit()}
          >
            {t("refund.continueToConfirm")}
          </Button>
        }
      >
        <div className="px-s4 pt-s4">
          <QueryBoundary
            query={state.query}
            skeleton={<SkeletonList rows={5} rowClassName="h-row-56" label={t("refund.loading")} />}
          >
            {(data) =>
              limits.isRateLimited ? (
                <RefundRateLimited
                  allowedPerHour={data.refundsAllowedPerHour}
                  resetsAtIso={data.rateLimitResetsAtIso}
                />
              ) : (
                <div className="flex flex-col gap-s5">
                  <RefundForm context={data} state={state} />
                  <RefundPayoutChoice
                    providerName={data.booking.providerName ?? ""}
                    providerPayoutPaise={data.providerPayoutPaise}
                    value={values.payoutImpact as RefundPayoutImpact}
                    onValueChange={(next) => {
                      state.form.form.setValue("payoutImpact", next);
                      state.markDirty();
                    }}
                  />
                </div>
              )
            }
          </QueryBoundary>
        </div>
      </MobileActionScreen>

      <StepUpChallenge
        stepUp={state.stepUp}
        tone="brand"
        title={t("refund.confirmTitle")}
        summary={refundSummaryLine(context ?? null, values, t)}
        preview={{
          label: t("refund.customerWillReceive"),
          body: refundCustomerMessage(context ?? null, values, t),
        }}
        confirmLabel={t("shared.confirmWithBiometrics")}
      />

      <DiscardChangesPrompt
        isOpen={state.discard.isPrompting}
        isDesktop={false}
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
