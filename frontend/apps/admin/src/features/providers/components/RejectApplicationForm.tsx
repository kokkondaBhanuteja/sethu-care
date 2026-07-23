import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { RadioGroup } from "../../../components/ui/form/RadioGroup";
import { TextArea } from "../../../components/ui/form/TextArea";
import { cx } from "../../../lib/cx";
import {
  REJECT_NOTE_MAXIMUM,
  REJECT_NOTE_MINIMUM,
  REJECT_REASON_LABEL_KEYS,
  REJECT_REASON_ORDER,
} from "../providers.constants";
import type { RejectReasonCode } from "../applications.types";

export interface RejectDraft {
  readonly reasonCode: RejectReasonCode | null;
  readonly note: string;
}

export interface RejectApplicationFormProps {
  draft: RejectDraft;
  onChange: (draft: RejectDraft) => void;
  /** A server-declared 422 on the note (the floor is server-enforced), rendered ON the field. */
  serverNoteError?: string | null;
}

/**
 * Both gates are hard, because rejection is irreversible for the applicant: a reason code is
 * mandatory (the platform reports rejection reasons in aggregate, which a free-text-only reject
 * would make impossible) and the note has a 20-character floor shown in red until it is met.
 */
export function RejectApplicationForm({
  draft,
  onChange,
  serverNoteError,
}: RejectApplicationFormProps) {
  const { t } = useTranslation("adminProviders");
  const [wasTouched, setWasTouched] = useState(false);
  const isNoteTooShort = draft.note.trim().length < REJECT_NOTE_MINIMUM;

  return (
    <div className="flex flex-col gap-s4">
      <RadioGroup
        legend={t("review.rejectReasonLabel")}
        tone="danger"
        required
        name="reject-reason"
        value={draft.reasonCode}
        onValueChange={(reasonCode) => onChange({ ...draft, reasonCode })}
        options={REJECT_REASON_ORDER.map((code) => ({
          value: code,
          label: t(REJECT_REASON_LABEL_KEYS[code]),
        }))}
        {...(wasTouched && draft.reasonCode === null
          ? { error: t("review.rejectReasonRequired") }
          : {})}
      />

      <div>
        <TextArea
          label={t("review.rejectNoteLabel")}
          placeholder={t("review.rejectNotePlaceholder")}
          required
          tall
          value={draft.note}
          maxLength={REJECT_NOTE_MAXIMUM}
          onBlur={() => setWasTouched(true)}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          {...(serverNoteError ? { error: serverNoteError } : {})}
        />
        <p
          aria-live="polite"
          className={cx("text-caption", isNoteTooShort ? "text-danger" : "text-text-3")}
        >
          {t("review.rejectNoteCounter", {
            count: draft.note.trim().length,
            minimum: REJECT_NOTE_MINIMUM,
          })}
        </p>
      </div>
    </div>
  );
}

export function isRejectDraftComplete(draft: RejectDraft): boolean {
  return draft.reasonCode !== null && draft.note.trim().length >= REJECT_NOTE_MINIMUM;
}
