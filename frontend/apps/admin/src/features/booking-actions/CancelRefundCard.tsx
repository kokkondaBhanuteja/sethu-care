import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Checkbox } from "../../components/ui/form/Checkbox";
import { RadioGroup } from "../../components/ui/form/RadioGroup";
import { TextArea } from "../../components/ui/form/TextArea";
import { TextInput } from "../../components/ui/form/TextInput";
import { formatMoney } from "../../lib/format";
import { NOTE_MAX_LENGTH } from "./booking-actions.constants";
import { paiseToRupeeInput } from "./booking-actions.money";
import type { CancelValues } from "./useCancelBooking";

export interface CancelRefundCardProps {
  form: UseFormReturn<CancelValues>;
  policyRefundPaise: number;
  isPolicyRefundFull: boolean;
  errorFor: (field: keyof CancelValues) => string | undefined;
  onChange: () => void;
}

const REFUND_MODES = { policy: "policy", custom: "custom" } as const;
type RefundMode = (typeof REFUND_MODES)[keyof typeof REFUND_MODES];

/**
 * The policy amount stays selected and pre-filled, so overriding is a deliberate two-step act —
 * switch the radio, then type a different number — rather than something that can happen by tabbing
 * through the form. The justification lives INSIDE the card because an override and its reason are
 * one record in the audit log.
 */
export function CancelRefundCard({
  form,
  policyRefundPaise,
  isPolicyRefundFull,
  errorFor,
  onChange,
}: CancelRefundCardProps) {
  const { t } = useTranslation("adminBookingActions");
  const values = form.watch();
  const mode: RefundMode = values.useCustomRefund ? REFUND_MODES.custom : REFUND_MODES.policy;

  return (
    <Card tone="surface">
      <div className="flex items-center justify-between gap-s3">
        <span className="text-emph text-text-1">{t("cancel.policyRefund")}</span>
        <span className="text-section font-semibold text-text-1">
          {isPolicyRefundFull
            ? t("cancel.policyAmountFull", { amount: formatMoney(policyRefundPaise) })
            : formatMoney(policyRefundPaise)}
        </span>
      </div>
      <p className="mt-s1 text-caption text-text-3">{t("cancel.policyComputed")}</p>

      {!values.useCustomRefund ? (
        <Button
          variant="textBrand"
          size="inline"
          className="mt-s3"
          onClick={() => {
            form.setValue("useCustomRefund", true);
            form.setValue("customAmountRupees", paiseToRupeeInput(policyRefundPaise));
            onChange();
          }}
        >
          {t("cancel.overrideAmount")}
        </Button>
      ) : null}

      {values.useCustomRefund ? (
        <div className="mt-s3 flex flex-col gap-s3 border-t border-border-subtle pt-s3">
          <RadioGroup
            legend={t("cancel.refundAmountLegend")}
            name="cancel-refund-mode"
            value={mode}
            onValueChange={(next) => {
              form.setValue("useCustomRefund", next === REFUND_MODES.custom);
              onChange();
            }}
            options={[
              {
                value: REFUND_MODES.policy,
                label: t("cancel.policyAmountOption", { amount: formatMoney(policyRefundPaise) }),
              },
              { value: REFUND_MODES.custom, label: t("cancel.customAmountOption") },
            ]}
          />

          <TextInput
            label={t("cancel.customAmountLabel")}
            type="number"
            min={0}
            inputMode="decimal"
            {...(errorFor("customAmountRupees")
              ? { error: errorFor("customAmountRupees") ?? "" }
              : {})}
            {...form.register("customAmountRupees", { valueAsNumber: true, onChange })}
          />

          <Checkbox
            checked={values.waiveFee}
            onCheckedChange={(checked) => {
              form.setValue("waiveFee", checked);
              onChange();
            }}
            label={t("cancel.waiveFee")}
          />

          <TextArea
            label={t("cancel.overrideJustification")}
            labelStyle="plain"
            required
            tall
            maxLength={NOTE_MAX_LENGTH}
            valueLength={values.overrideJustification.length}
            placeholder={t("cancel.overrideJustificationPlaceholder")}
            {...(errorFor("overrideJustification")
              ? { error: t("cancel.overrideJustificationRequired") }
              : {})}
            {...form.register("overrideJustification", { onChange })}
          />
        </div>
      ) : null}
    </Card>
  );
}
