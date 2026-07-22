import { useTranslation } from "@sethu/i18n";

import { TextArea } from "../../components/ui/form/TextArea";
import { ReasonCodeField } from "./ReasonCodeField";
import { RefundAmountField } from "./RefundAmountField";
import { RefundTypeList } from "./RefundTypeList";
import {
  NOTE_MAX_LENGTH,
  REFUND_REASON_ORDER,
  type RefundReasonCode,
  type RefundTypeId,
} from "./booking-actions.constants";
import type { RefundContext } from "./booking-actions.types";
import { refundLimits } from "./refundLimits";
import type { RefundState } from "./useRefund";

export interface RefundFormProps {
  context: RefundContext;
  state: RefundState;
}

/** The left-hand column on desktop and the whole scroll region on mobile: everything CHOSEN. */
export function RefundForm({ context, state }: RefundFormProps) {
  const { t } = useTranslation("adminBookingActions");
  const { form, errorFor } = state.form;
  const values = form.watch();
  const limits = refundLimits(context, values.refundType, values.amountRupees);

  return (
    <div className="flex flex-col gap-s4">
      <RefundTypeList
        value={values.refundType as RefundTypeId}
        onValueChange={(next) => {
          form.setValue("refundType", next);
          state.markDirty();
        }}
      />

      <RefundAmountField
        context={context}
        limits={limits}
        amountRupees={values.amountRupees}
        onAmountChange={(next) => {
          form.setValue("amountRupees", next);
          state.markDirty();
        }}
      />

      <ReasonCodeField<RefundReasonCode>
        name="refund-reason"
        legend={t("refund.reasonLegend")}
        value={(values.reasonCode as RefundReasonCode) || null}
        onValueChange={state.selectReason}
        {...(errorFor("reasonCode") ? { error: t("refund.reasonRequired") } : {})}
        options={REFUND_REASON_ORDER.map((code) => ({
          value: code,
          label: t(`refund.reason.${code}`),
        }))}
      />

      <TextArea
        label={t("refund.noteLabel")}
        maxLength={NOTE_MAX_LENGTH}
        valueLength={values.note.length}
        placeholder={t("refund.notePlaceholder")}
        {...form.register("note", { onChange: state.markDirty })}
      />
    </div>
  );
}
