import { useId } from "react";
import { useTranslation } from "@sethu/i18n";

import { formatMoney } from "../../lib/format";
import { paiseToRupeeInput, rupeesToPaise } from "./booking-actions.money";

export interface RedispatchIncentiveFieldProps {
  /** Rupees, because that is what an operator drags; converted at the form boundary. */
  value: number;
  capPaise: number;
  capLabel: string;
  onValueChange: (value: number) => void;
}

const STEP_RUPEES = 50;

/**
 * The incentive bump, drawn as a range because ops managers settle on round fractions far more
 * often than on an exact figure. The platform cost is stated under it — the money this adds comes
 * out of the platform, not the customer, and that should not need to be inferred.
 *
 * A native range input: the design system has no Slider primitive yet, and a real `input[type=range]`
 * is keyboard- and screen-reader-complete without one.
 */
export function RedispatchIncentiveField({
  value,
  capPaise,
  capLabel,
  onValueChange,
}: RedispatchIncentiveFieldProps) {
  const { t } = useTranslation("adminBookingActions");
  const fieldId = useId();
  const maxRupees = paiseToRupeeInput(capPaise);

  return (
    <div className="flex flex-col gap-s2">
      <label htmlFor={fieldId} className="text-pill text-text-2 uppercase">
        {t("redispatch.incentiveLabel")}
      </label>

      <div className="flex items-center gap-s3">
        <div className="flex-1">
          <input
            id={fieldId}
            type="range"
            min={0}
            max={maxRupees}
            step={STEP_RUPEES}
            value={value}
            onChange={(event) => onValueChange(Number(event.target.value))}
            className="w-full accent-brand"
            aria-valuetext={formatMoney(rupeesToPaise(value))}
          />
          <div className="flex justify-between text-caption text-text-3">
            <span>{formatMoney(0)}</span>
            <span>{formatMoney(capPaise)}</span>
          </div>
        </div>
        <span className="text-section font-semibold text-text-1">
          {formatMoney(rupeesToPaise(value))}
        </span>
      </div>

      <p className="text-caption text-text-3">{capLabel}</p>
      <p className="text-caption text-warning">
        {t("redispatch.platformCost", { amount: formatMoney(rupeesToPaise(value)) })}
      </p>
    </div>
  );
}
