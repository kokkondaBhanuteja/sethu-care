import { useId } from "react";

import { cx } from "../../../lib/cx";
import { Field } from "./Field";

export interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Renders the current value beside the label — a slider with no readout is a guess. */
  formatValue: (value: number) => string;
  /** Endpoint captions under the track, e.g. "None" / "₹200". */
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  labelStyle?: "ops" | "plain";
}

/**
 * A bounded numeric control — the re-dispatch incentive bump is the only one in the console.
 *
 * A real `<input type="range">` sits transparently over the design's track, so arrow keys, Home/End,
 * touch and every screen reader work without reimplementation. The visible track is painted beneath
 * it and is purely decorative.
 */
export function Slider({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  formatValue,
  minLabel,
  maxLabel,
  disabled = false,
  labelStyle = "ops",
}: SliderProps) {
  const fieldId = useId();
  const filledFraction = max === min ? 0 : (value - min) / (max - min);

  return (
    <Field label={label} htmlFor={fieldId} labelStyle={labelStyle}>
      <div className={cx("flex flex-col gap-s1", disabled && "is-disabled")}>
        <div className="row-between">
          <span className="t-caption c-3">{minLabel}</span>
          <span className="t-emph c-1">{formatValue(value)}</span>
          <span className="t-caption c-3">{maxLabel}</span>
        </div>

        <div className="slider">
          <span aria-hidden className="slider__track">
            <span
              className="slider__fill"
              style={{ width: `${Math.round(filledFraction * 100)}%` }}
            />
          </span>
          <input
            id={fieldId}
            type="range"
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-valuetext={formatValue(value)}
            onChange={(event) => onValueChange(Number(event.target.value))}
          />
        </div>
      </div>
    </Field>
  );
}
