import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SkeletonList } from "../../components/ui/Skeleton";
import { formatDate, formatMoney } from "../../lib/format";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";
import { RefundForm } from "./RefundForm";
import { RefundPayoutChoice } from "./RefundPayoutChoice";
import { RefundRateLimited } from "./RefundRateLimited";
import { RefundSummaryPanel } from "./RefundSummaryPanel";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import type { RefundPayoutImpact, RefundTypeId } from "./booking-actions.constants";
import { refundLimits } from "./refundLimits";
import { refundCustomerMessage, refundSummaryLine } from "./refundSummary";
import type { RefundState } from "./useRefund";

/**
 * BOX 78–81. A wide modal split 60/40: everything the operator CHOOSES on the left — including the
 * provider-payout decision, which is a money choice and belongs in the form column, exactly where
 * mobile puts it — and a READ-ONLY summary of what the choices produce on the right. The booking
 * stays legible behind the scrim because a refund is an irreversible money movement and the record
 * that justifies it should not disappear the moment the form opens.
 */
export function RefundDesktop({ state }: { state: RefundState }) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  const context = state.query.data;
  const values = state.form.form.watch();
  const limits = refundLimits(context ?? null, values.refundType, values.amountRupees);

  return (
    <>
      <Modal
        isOpen
        width="wide"
        title={t("refund.title")}
        {...(context
          ? {
              subtitle: t("refund.subtitle", {
                reference: context.booking.reference,
                service: context.booking.serviceName,
                customer: context.booking.customerName,
                amount: formatMoney(context.bookingValuePaise),
                method: context.originalMethodLabel,
                date: formatDate(context.paidAtIso),
              }),
            }
          : {})}
        isDismissable={!state.form.isSubmitting && !state.discard.isPrompting}
        onDismiss={state.requestExit}
        footer={
          limits.isRateLimited ? (
            // The rate-limited state has already replaced the form; a dead disabled commit next to
            // it would invite hunting for the control that re-enables it. One way out: Close.
            <Button variant="outline" size="section" onClick={state.requestExit}>
              {tShell("actions.close")}
            </Button>
          ) : (
            <>
              <Button variant="text" size="section" onClick={state.requestExit}>
                {tShell("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                size="section"
                disabled={limits.isBlocked}
                isLoading={state.form.isSubmitting}
                onClick={() => void state.form.handleSubmit()}
              >
                {t("refund.continueToConfirm")}
              </Button>
            </>
          )
        }
      >
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
              <div className="grid gap-s5 lg:grid-cols-5">
                <div className="flex min-w-0 flex-col gap-s4 lg:col-span-3">
                  <RefundForm context={data} state={state} />
                  <RefundPayoutChoice
                    providerName={data.booking.providerName ?? ""}
                    providerPayoutPaise={data.providerPayoutPaise}
                    value={values.payoutImpact ? (values.payoutImpact as RefundPayoutImpact) : null}
                    onValueChange={(next) => {
                      state.form.form.setValue("payoutImpact", next);
                      state.markDirty();
                    }}
                  />
                </div>
                <div className="lg:col-span-2">
                  <RefundSummaryPanel
                    context={data}
                    refundType={values.refundType as RefundTypeId}
                    amountRupees={values.amountRupees}
                  />
                </div>
              </div>
            )
          }
        </QueryBoundary>
      </Modal>

      <StepUpChallenge
        stepUp={state.stepUp}
        tone="brand"
        title={t("refund.confirmTitle")}
        summary={refundSummaryLine(context ?? null, values, t)}
        preview={{
          label: t("refund.customerWillReceive"),
          body: refundCustomerMessage(context ?? null, values, t),
        }}
        confirmLabel={tShell("actions.confirm")}
      />

      <DiscardChangesPrompt
        isOpen={state.discard.isPrompting}
        isDesktop
        onDiscard={state.discard.confirmDiscard}
        onKeepEditing={state.discard.keepEditing}
      />
    </>
  );
}
