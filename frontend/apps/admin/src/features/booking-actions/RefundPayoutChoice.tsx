import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { RadioGroup } from "../../components/ui/form/RadioGroup";
import { formatMoney } from "../../lib/format";
import { REFUND_PAYOUT_IMPACTS, type RefundPayoutImpact } from "./booking-actions.constants";

export interface RefundPayoutChoiceProps {
  providerName: string;
  providerPayoutPaise: number;
  /** Null until a reason is chosen — the recommendation follows the reason, never precedes it. */
  value: RefundPayoutImpact | null;
  onValueChange: (value: RefundPayoutImpact) => void;
}

/**
 * Amber, edged and set apart: this is the SECOND person's money. Refunding a customer for a job the
 * provider completed correctly should not silently penalise the provider, so nothing is selected
 * until a reason is chosen — the reason applies the recommended impact (still editable) — and "pay
 * anyway" costs a note; it can never be the silent path (spec §6.27).
 */
export function RefundPayoutChoice({
  providerName,
  providerPayoutPaise,
  value,
  onValueChange,
}: RefundPayoutChoiceProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <Card tone="warning" edge="warning">
      <RadioGroup<RefundPayoutImpact>
        legend={t("refund.payoutLegend")}
        name="refund-payout"
        value={value}
        onValueChange={onValueChange}
        options={[
          {
            value: REFUND_PAYOUT_IMPACTS.withhold,
            label: t("refund.payoutWithhold", {
              name: providerName,
              amount: formatMoney(providerPayoutPaise),
            }),
            description: t("refund.payoutWithholdHint"),
          },
          {
            value: REFUND_PAYOUT_IMPACTS.payAnyway,
            label: t("refund.payoutPayAnyway"),
            description: t("refund.payoutPayAnywayHint"),
          },
        ]}
      />
      <p className="text-caption text-text-1">{t("refund.payoutNotified")}</p>
    </Card>
  );
}
