import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../components/ui/Pill";
import { RadioGroup } from "../../components/ui/form/RadioGroup";
import {
  INSTANT_REFUND_TYPES,
  REFUND_TYPE_ORDER,
  type RefundTypeId,
} from "./booking-actions.constants";

export interface RefundTypeListProps {
  value: RefundTypeId;
  onValueChange: (value: RefundTypeId) => void;
}

/**
 * Each card carries a radio as well as the selected border and tint: selection here decides where
 * the money goes, and that cannot rest on colour alone (spec §4.8).
 *
 * The timing chip gets its own slot because "when does the customer get it back?" is what an ops
 * manager actually optimises for on a hot call.
 */
export function RefundTypeList({ value, onValueChange }: RefundTypeListProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <RadioGroup<RefundTypeId>
      legend={t("refund.typeLegend")}
      name="refund-type"
      asCards
      required
      value={value}
      onValueChange={onValueChange}
      options={REFUND_TYPE_ORDER.map((typeId) => ({
        value: typeId,
        label: (
          <span className="flex items-center justify-between gap-s2">
            <span>{t(`refund.type.${typeId}`)}</span>
            <Pill tone={INSTANT_REFUND_TYPES.has(typeId) ? "success" : "neutral"}>
              {INSTANT_REFUND_TYPES.has(typeId) ? t("refund.instant") : t("refund.bankingDays")}
            </Pill>
          </span>
        ),
        description: t(`refund.typeHint.${typeId}`),
      }))}
    />
  );
}
