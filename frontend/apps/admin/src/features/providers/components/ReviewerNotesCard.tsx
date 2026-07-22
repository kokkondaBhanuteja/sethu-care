import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../../components/ui/Card";
import { TextArea } from "../../../components/ui/form/TextArea";

const NOTE_MAXIMUM = 500;

/**
 * A note for the NEXT reviewer, not a decision. Kept separate from the rejection note so an
 * operator cannot mistake a handover comment for the reason an application was refused.
 *
 * Deliberately a scratchpad: there is no notes mutation yet, so there is no "Add note" button —
 * a submit affordance that persisted nothing would be a lie. The hint says so out loud; the
 * button returns with the API.
 */
export function ReviewerNotesCard() {
  const { t } = useTranslation("adminProviders");
  const [note, setNote] = useState("");

  return (
    <Card>
      <TextArea
        label={t("review.reviewerNotes")}
        placeholder={t("review.reviewerNotesPlaceholder")}
        hint={t("review.reviewerNotesHint")}
        value={note}
        maxLength={NOTE_MAXIMUM}
        onChange={(event) => setNote(event.target.value)}
      />
    </Card>
  );
}
