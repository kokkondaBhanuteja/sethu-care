import { useTranslation } from "@sethu/i18n";

import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { StatusDot } from "../../components/ui/StatusDot";
import { formatDateTime } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { eventTone } from "./SecurityEventList";
import { SECURITY_EVENT_KINDS } from "./settings.constants";
import type { SecurityEvent } from "./settings.types";

export interface SecurityEventTableProps {
  events: readonly SecurityEvent[];
}

/**
 * BOX 62 — recent security events as a table. The failed attempt is the one row that matters, so it
 * carries the amber row tint as well as its dot, and its unknown device and location stay as words.
 */
export function SecurityEventTable({ events }: SecurityEventTableProps) {
  const { t } = useTranslation("adminSettings");
  const unknown = t("security.event.unknown");

  const columns: readonly DataTableColumn<SecurityEvent>[] = [
    {
      id: "event",
      header: t("security.columnEvent"),
      render: (event) => {
        const label = t(`security.event.${event.kind}`);
        return (
          <span className="flex items-center gap-s2">
            <StatusDot tone={eventTone(event)} label={label} />
            {label}
          </span>
        );
      },
    },
    {
      id: "device",
      header: t("security.columnDevice"),
      cellClassName: "text-text-2",
      render: (event) => event.device ?? unknown,
    },
    {
      id: "location",
      header: t("security.columnLocation"),
      cellClassName: "text-text-2",
      render: (event) => event.location ?? unknown,
    },
    {
      id: "when",
      header: t("security.columnWhen"),
      cellClassName: "text-text-2",
      render: (event) => formatDateTime(event.atIso),
    },
  ];

  return (
    <SettingsGroup title={t("security.groupEvents")}>
      <SettingsCard>
        <DataTable
          caption={t("security.eventsCaption")}
          columns={columns}
          rows={events}
          rowKey={(event) => event.id}
          density="dense"
          rowTone={(event) =>
            event.kind === SECURITY_EVENT_KINDS.failedSignIn ? "warning" : "default"
          }
        />
      </SettingsCard>
    </SettingsGroup>
  );
}
