import { useTranslation } from "@sethu/i18n";

import { Checkbox } from "../../components/ui/form/Checkbox";
import { TextArea } from "../../components/ui/form/TextArea";
import { ReasonCodeField } from "./ReasonCodeField";
import {
  MANUAL_COMPLETION_NOTE_MIN_LENGTH,
  MANUAL_COMPLETION_REASON_ORDER,
  NOTE_MAX_LENGTH,
  type ManualCompletionReasonCode,
} from "./booking-actions.constants";
import type { ManualCompletionState } from "./useManualCompletion";

/**
 * Step 1. Six reasons in a single column even though the cancel modal runs two: nine cancellation
 * reasons are a catalogue to scan, six OTP failures are a diagnosis to read, and a second column
 * would invite the eye to skim past the one that actually applies.
 */
export function ManualCompletionReasonStep({ state }: { state: ManualCompletionState }) {
  const { t } = useTranslation("adminBookingActions");
  const { form, errorFor } = state.form;
  const values = form.watch();

  return (
    <div className="flex flex-col gap-s4">
      <h2 className="text-section text-text-1">{t("manual.reasonTitle")}</h2>

      <ReasonCodeField<ManualCompletionReasonCode>
        name="manual-completion-reason"
        legend={t("manual.reasonLegend")}
        value={(values.reasonCode as ManualCompletionReasonCode) || null}
        onValueChange={(code) => {
          form.setValue("reasonCode", code);
          state.markDirty();
        }}
        {...(errorFor("reasonCode") ? { error: t("manual.reasonRequired") } : {})}
        options={MANUAL_COMPLETION_REASON_ORDER.map((code) => ({
          value: code,
          label: t(`manual.reason.${code}`),
        }))}
      />
    </div>
  );
}

/**
 * Step 3. First-person copy, because this is the part only a person can supply. The note has a
 * 20-character minimum: the target is a real sentence, not a keystroke.
 */
export function ManualCompletionVerifyStep({ state }: { state: ManualCompletionState }) {
  const { t } = useTranslation("adminBookingActions");
  const { form, errorFor } = state.form;
  const values = form.watch();

  const attestations = [
    { field: "spokeToProvider", checked: values.spokeToProvider },
    { field: "attemptedCustomer", checked: values.attemptedCustomer },
    { field: "believesWorkDone", checked: values.believesWorkDone },
  ] as const;

  return (
    <div className="flex flex-col gap-s4">
      <div>
        <h2 className="text-section text-text-1">{t("manual.verifyTitle")}</h2>
        <p className="text-label text-text-2">{t("manual.verifySubtitle")}</p>
      </div>

      <div className="flex flex-col">
        {attestations.map((attestation) => (
          <Checkbox
            key={attestation.field}
            checked={attestation.checked}
            onCheckedChange={(checked) => {
              // The literal(true) schema is what makes an unchecked box a validation failure.
              form.setValue(attestation.field, checked as true);
              state.markDirty();
            }}
            label={t(`manual.attestation.${attestation.field}`)}
          />
        ))}
      </div>

      <TextArea
        label={t("manual.notesLabel")}
        required
        tall
        maxLength={NOTE_MAX_LENGTH}
        valueLength={values.note.length}
        hint={t("manual.notesHint", { min: MANUAL_COMPLETION_NOTE_MIN_LENGTH })}
        {...(errorFor("note") ? { error: t("manual.notesTooShort") } : {})}
        {...form.register("note", { onChange: state.markDirty })}
      />
    </div>
  );
}
