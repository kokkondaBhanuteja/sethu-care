import { Check, Smartphone, Tablet } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatRelative } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { DEVICE_KINDS } from "./settings.constants";
import type { SecuritySettings, TrustedDevice } from "./settings.types";

export interface TrustedDeviceTableProps {
  security: SecuritySettings;
  canRevoke: boolean;
  onRevoke: (device: TrustedDevice) => void;
}

/**
 * BOX 62 — a table, not three stacked cards: LAST USED is the column an admin actually scans when
 * deciding which device to give up, and a column is what makes that scan possible.
 */
export function TrustedDeviceTable({ security, canRevoke, onRevoke }: TrustedDeviceTableProps) {
  const { t } = useTranslation("adminSettings");
  const isAtLimit = security.devices.length >= security.deviceLimit;

  const columns: readonly DataTableColumn<TrustedDevice>[] = [
    {
      id: "device",
      header: t("security.columnDevice"),
      render: (device) => (
        <span className="flex items-center gap-s2">
          <Icon
            glyph={device.kind === DEVICE_KINDS.tablet ? Tablet : Smartphone}
            className="text-text-2"
          />
          {device.name}
        </span>
      ),
    },
    {
      id: "lastUsed",
      header: t("security.columnLastUsed"),
      cellClassName: "text-text-2",
      render: (device) => formatRelative(device.lastUsedIso),
    },
    {
      id: "location",
      header: t("security.columnLocation"),
      cellClassName: "text-text-2",
      render: (device) => device.location,
    },
    {
      id: "action",
      header: t("security.columnAction"),
      render: (device) =>
        device.isCurrent ? (
          <Pill tone="success" icon={Check}>
            {t("security.current")}
          </Pill>
        ) : (
          <Button
            variant="textDanger"
            size="inline"
            disabled={!canRevoke}
            onClick={() => onRevoke(device)}
          >
            {t("security.revoke")}
          </Button>
        ),
    },
  ];

  return (
    <SettingsGroup
      title={t("security.groupDevices", {
        used: security.devices.length,
        limit: security.deviceLimit,
      })}
      foot={isAtLimit ? t("security.deviceLimitReached") : undefined}
      footTone="warning"
    >
      <SettingsCard>
        <DataTable
          caption={t("security.devicesCaption")}
          columns={columns}
          rows={security.devices}
          rowKey={(device) => device.id}
          density="dense"
          onRowClick={(device) => (device.isCurrent && canRevoke ? onRevoke(device) : undefined)}
        />
      </SettingsCard>
    </SettingsGroup>
  );
}
