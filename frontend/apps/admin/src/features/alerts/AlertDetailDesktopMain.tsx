import { AlertMuteControl } from "./AlertMuteControl";
import { AlertNotes } from "./AlertNotes";
import { AlertTriggerCard } from "./AlertTriggerCard";
import type { AlertDetail } from "./alerts.types";

export interface AlertDetailDesktopMainProps {
  alert: AlertDetail;
  onAddNote: (body: string) => void;
  isAddingNote: boolean;
}

/**
 * Desktop BOX 22, left column: what fired, and what can be done about the rule. An alert is a claim
 * the system makes about itself, so this column has to be auditable.
 */
export function AlertDetailDesktopMain({
  alert,
  onAddNote,
  isAddingNote,
}: AlertDetailDesktopMainProps) {
  return (
    <div className="flex flex-col gap-s5">
      <p className="m-0 max-w-prose text-body text-text-1">{alert.description}</p>

      <AlertTriggerCard trigger={alert.trigger} severity={alert.severity} columns />

      <AlertMuteControl canMute={alert.canMute} />

      <AlertNotes notes={alert.notes} onAdd={onAddNote} isAdding={isAddingNote} />
    </div>
  );
}
