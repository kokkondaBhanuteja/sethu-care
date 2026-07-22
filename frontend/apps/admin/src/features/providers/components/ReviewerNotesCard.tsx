import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { TextArea } from "../../../components/ui/form/TextArea";
import { SectionLabel } from "./SectionLabel";

const NOTE_MAXIMUM = 500;

/**
 * A note for the NEXT reviewer, not a decision. Kept separate from the rejection note so an
 * operator cannot mistake a handover comment for the reason an application was refused.
 */
export function ReviewerNotesCard() {
  const { t } = useTranslation("adminProviders");
  const [note, setNote] = useState("");

  return (
    <Card>
      <SectionLabel className="mb-s3">{t("review.reviewerNotes")}</SectionLabel>
      <TextArea
        label={t("review.reviewerNotes")}
        placeholder={t("review.reviewerNotesPlaceholder")}
        value={note}
        maxLength={NOTE_MAXIMUM}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button variant="outline" size="inline" className="mt-s3" disabled={note.trim().length === 0}>
        {t("review.addNote")}
      </Button>
    </Card>
  );
}
