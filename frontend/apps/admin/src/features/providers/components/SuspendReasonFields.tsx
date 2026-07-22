import { useTranslation } from "@sethu/i18n";

import { RadioGroup } from "../../../components/ui/form/RadioGroup";
import { TextArea } from "../../../components/ui/form/TextArea";
import {
  SUSPEND_NOTE_MAXIMUM,
  SUSPEND_REASON_LABEL_KEYS,
  SUSPEND_REASON_ORDER,
} from "../providers.constants";
import { SUSPEND_REASON_CODES, type SuspendReasonCode } from "../suspend.types";

export interface SuspendReasonFieldsProps {
  reasonCode: SuspendReasonCode | null;
  onReasonChange: (value: SuspendReasonCode) => void;
  note: string;
  onNoteChange: (value: string) => void;
}

/**
 * The reason code the audit log stores. It is required for every action type in this flow — the
 * risk register marks force-offline, suspend and block all as reason-carrying (spec §10.3) — and
 * "Other" additionally requires the note, because a reason code of "Other" explains nothing.
 */
export function SuspendReasonFields({
  reasonCode,
  onReasonChange,
  note,
  onNoteChange,
}: SuspendReasonFieldsProps) {
  const { t } = useTranslation("adminProviders");
  const needsNote = reasonCode === SUSPEND_REASON_CODES.other && note.trim().length === 0;

  return (
    <div>
      <RadioGroup
        legend={t("suspend.reasonLabel")}
        tone="danger"
        required
        name="suspend-reason"
        value={reasonCode}
        onValueChange={onReasonChange}
        options={SUSPEND_REASON_ORDER.map((code) => ({
          value: code,
          label: t(SUSPEND_REASON_LABEL_KEYS[code]),
        }))}
        {...(needsNote ? { error: t("suspend.noteRequiredForOther") } : {})}
      />

      <TextArea
        label={t("suspend.noteLabel")}
        placeholder={t("suspend.notePlaceholder")}
        value={note}
        valueLength={note.length}
        maxLength={SUSPEND_NOTE_MAXIMUM}
        onChange={(event) => onNoteChange(event.target.value)}
        required={reasonCode === SUSPEND_REASON_CODES.other}
      />
    </div>
  );
}
