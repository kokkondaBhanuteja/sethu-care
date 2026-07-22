import { cx } from "../../lib/cx";

export interface StepDefinition {
  readonly id: string;
  readonly label: string;
}

export interface StepRailProps {
  label: string;
  steps: readonly StepDefinition[];
  /** Zero-based index of the step being shown. */
  activeIndex: number;
  /** Marks completed step dots red — used by the flows whose outcome is destructive. */
  tone?: "brand" | "danger";
  footer?: React.ReactNode;
}

/**
 * The left rail of a multi-step destructive flow (manual completion, suspend provider). Its job is
 * to make the remaining commitment visible: an operator on step 2 of 4 of a manual completion can
 * see there are two more gates before anything irreversible happens.
 */
export function StepRail({ label, steps, activeIndex, tone = "brand", footer }: StepRailProps) {
  return (
    <nav className="steprail" aria-label={label}>
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cx(
              "steprail__item",
              index < activeIndex && "is-done",
              index === activeIndex && "is-active",
            )}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span className="steprail__marker">
              {index < activeIndex ? (
                <span
                  className={cx("steprail__dot", tone === "danger" && "steprail__dot--danger")}
                />
              ) : (
                <span className="steprail__num">{index + 1}</span>
              )}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      {footer ? <div className="steprail__foot">{footer}</div> : null}
    </nav>
  );
}

export interface StepperProps {
  /** Total steps in the flow. */
  count: number;
  activeIndex: number;
  tone?: "brand" | "danger";
  label: string;
}

/** The mobile equivalent: a segmented progress bar above the sheet's content. */
export function Stepper({ count, activeIndex, tone = "brand", label }: StepperProps) {
  return (
    <div
      className="stepper"
      role="progressbar"
      aria-label={label}
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={count}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cx(
            "stepper__seg",
            index <= activeIndex && (tone === "danger" ? "is-done-danger" : "is-done"),
          )}
        />
      ))}
    </div>
  );
}
