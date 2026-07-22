import { StatusDot } from "../../components/ui/StatusDot";
import { RadioGroup } from "../../components/ui/form/RadioGroup";

export interface ReasonChoice<TCode extends string> {
  readonly value: TCode;
  readonly label: string;
  /** Marks a reason that routes the action somewhere different — a safety review, for instance. */
  readonly isFlagged?: boolean;
}

export interface ReasonCodeFieldProps<TCode extends string> {
  legend: string;
  options: readonly ReasonChoice<TCode>[];
  value: TCode | null;
  onValueChange: (value: TCode) => void;
  /** What the flag means, in words. A coloured dot alone carries meaning nobody can read (§4.8). */
  flaggedMeaning?: string;
  /** The legend under the list, spelling the dot out for sighted readers too. */
  flaggedLegend?: string;
  tone?: "brand" | "danger";
  error?: string;
  name: string;
}

/**
 * The reason picker that gates every destructive flow. Codes go over the wire, labels stay on the
 * screen — the audit log and the safety-review router key off the code, and a translated string is
 * not an identifier.
 */
export function ReasonCodeField<TCode extends string>({
  legend,
  options,
  value,
  onValueChange,
  flaggedMeaning,
  flaggedLegend,
  tone = "brand",
  error,
  name,
}: ReasonCodeFieldProps<TCode>) {
  return (
    <div className="flex flex-col gap-s2">
      <RadioGroup
        legend={legend}
        name={name}
        required
        tone={tone}
        value={value}
        onValueChange={onValueChange}
        {...(error ? { error } : {})}
        options={options.map((option) => ({
          value: option.value,
          label:
            option.isFlagged && flaggedMeaning ? (
              <span className="inline-flex items-center gap-s2">
                {option.label}
                <StatusDot tone="danger" size="sm" label={flaggedMeaning} />
              </span>
            ) : (
              option.label
            ),
        }))}
      />

      {/* The dot's own label is the legend text, so assistive tech hears it exactly once. */}
      {flaggedLegend ? (
        <StatusDot tone="danger" size="sm" label={flaggedLegend} visualLabel />
      ) : null}
    </div>
  );
}
