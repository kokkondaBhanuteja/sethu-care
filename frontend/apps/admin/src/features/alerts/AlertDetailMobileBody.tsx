import { useTranslation } from "@sethu/i18n";

import { SectionHeader } from "../../components/ui/Panel";
import { AlertNotes } from "./AlertNotes";
import { AlertOwnership } from "./AlertOwnership";
import { AlertRelatedAlerts } from "./AlertRelatedAlerts";
import { AlertRelatedRecord } from "./AlertRelatedRecord";
import { AlertSeverityHeader } from "./AlertSeverityHeader";
import { AlertTriggerCard } from "./AlertTriggerCard";
import { ALERT_SEVERITIES, type AlertDetail } from "./alerts.types";

export interface AlertDetailMobileBodyProps {
  alert: AlertDetail;
  onAddNote: (body: string) => void;
  isAddingNote: boolean;
}

/** The 8px recessed strip the mobile detail screens use to separate sections. */
function SectionGap() {
  return <div className="h-s2 border-y border-border-subtle bg-surface" />;
}

/** Mobile BOX 38–40: the same layout for all three severities, with the shouting turned off. */
export function AlertDetailMobileBody({
  alert,
  onAddNote,
  isAddingNote,
}: AlertDetailMobileBodyProps) {
  const { t } = useTranslation("adminAlerts");

  return (
    <>
      <div className="p-s4">
        <AlertSeverityHeader alert={alert} />
      </div>
      <SectionGap />

      <p className="m-0 p-s4 text-body text-text-1">{alert.description}</p>
      <SectionGap />

      <SectionHeader title={t("trigger.heading")} />
      <div className="px-s4 pb-s4">
        <AlertTriggerCard trigger={alert.trigger} severity={alert.severity} showHeading={false} />
      </div>
      <SectionGap />

      {alert.relatedRecord ? (
        <>
          <SectionHeader title={t("relatedRecord")} />
          <div className="px-s4 pb-s4">
            <AlertRelatedRecord
              record={alert.relatedRecord}
              showEdge={alert.severity !== ALERT_SEVERITIES.informational}
            />
          </div>
          <SectionGap />
        </>
      ) : null}

      <SectionHeader title={t("ownership.heading")} />
      <div className="px-s4 pb-s4">
        <AlertOwnership alert={alert} />
      </div>
      <SectionGap />

      {alert.relatedAlerts.length > 0 ? (
        <>
          <div className="px-s4 pt-s4">
            <AlertRelatedAlerts alerts={alert.relatedAlerts} />
          </div>
          <SectionGap />
        </>
      ) : null}

      <div className="px-s4 py-s4">
        <AlertNotes notes={alert.notes} onAdd={onAddNote} isAdding={isAddingNote} collapsible />
      </div>
    </>
  );
}
