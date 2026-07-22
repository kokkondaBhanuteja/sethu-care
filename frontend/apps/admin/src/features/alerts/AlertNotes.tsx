import { useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextArea } from "../../components/ui/form/TextArea";
import { useAppForm } from "../../lib/forms/useAppForm";
import { formatTime } from "../../lib/format";
import type { AlertNote } from "./alerts.types";

const MAX_NOTE_LENGTH = 280;

const noteSchema = z.object({
  body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
});

type NoteValues = z.infer<typeof noteSchema>;

export interface AlertNotesProps {
  notes: readonly AlertNote[];
  onAdd: (body: string) => void;
  isAdding: boolean;
  /** Mobile keeps the composer behind a button until it is wanted; desktop shows it inline. */
  collapsible?: boolean;
}

/** The handover record between admins on the same alert (spec §6.21). */
export function AlertNotes({ notes, onAdd, isAdding, collapsible = false }: AlertNotesProps) {
  const { t } = useTranslation("adminAlerts");
  const { t: tShell } = useTranslation("adminShell");
  const [isComposing, setIsComposing] = useState(!collapsible);

  const { form, handleSubmit, isSubmitting, errorFor, reset } = useAppForm<NoteValues>({
    schema: noteSchema,
    defaultValues: { body: "" },
    onSubmit: async (values) => {
      onAdd(values.body);
      reset();
      if (collapsible) setIsComposing(false);
    },
  });

  return (
    <section aria-label={t("notes.heading")}>
      <h3 className="mb-s2 text-pill tracking-wide text-text-2 uppercase">{t("notes.heading")}</h3>

      {notes.length === 0 ? (
        <p className="mt-0 mb-s3 text-caption text-text-3">{t("notes.empty")}</p>
      ) : (
        <div className="mb-s3 flex flex-col gap-s2">
          {notes.map((note) => (
            <Card key={note.id} tone="surface" density="tight">
              <p className="m-0 text-label text-text-1">{note.body}</p>
              <p className="mt-s1 mb-0 text-caption text-text-3">
                {t("notes.byline", { name: note.authorName, time: formatTime(note.createdAt) })}
              </p>
            </Card>
          ))}
        </div>
      )}

      {isComposing ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-s2">
          <TextArea
            label={t("notes.label")}
            placeholder={t("notes.placeholder")}
            maxLength={MAX_NOTE_LENGTH}
            valueLength={form.watch("body").length}
            {...(errorFor("body") ? { error: errorFor("body") } : {})}
            {...form.register("body")}
          />
          <div className="flex gap-s2">
            <Button
              type="submit"
              variant="outline"
              size="section"
              isLoading={isSubmitting || isAdding}
            >
              {t("actions.addNote")}
            </Button>
            {collapsible ? (
              <Button variant="text" size="section" onClick={() => setIsComposing(false)}>
                {tShell("actions.cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="section"
          block
          iconStart={Plus}
          onClick={() => setIsComposing(true)}
        >
          {t("actions.addNote")}
        </Button>
      )}
    </section>
  );
}
