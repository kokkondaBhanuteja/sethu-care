import { Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { MAX_TRUSTED_DEVICES } from "./auth.constants";
import { DEVICE_TYPES, type DeviceType, type TrustedDevice } from "./auth.types";

// The iPad row uses the tablet glyph on purpose — the icon is often what an admin scans before the
// name, and a phone glyph beside "iPad Air" would misidentify the device being revoked.
const DEVICE_GLYPHS: Readonly<Record<DeviceType, LucideIcon>> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export interface DeviceLimitPickerProps {
  devices: readonly TrustedDevice[];
  onRevoke: (deviceId: string) => void;
  revokingDeviceId: string | null;
  onCancel: () => void;
}

/**
 * The trusted-device cap (spec §5.3: three) reached at sign-in.
 *
 * The screen refuses to choose for the admin: every row carries when it was last used and from
 * where, so the least-recently-used device is obvious without reading the names. Revoke is a text
 * button in the danger colour — three filled destructive buttons would read as the point of the
 * screen, and the point is the choice.
 */
export function DeviceLimitPicker({
  devices,
  onRevoke,
  revokingDeviceId,
  onCancel,
}: DeviceLimitPickerProps) {
  const { t } = useTranslation("adminAuth");
  const { t: tShell } = useTranslation("adminShell");

  // The glyph is often what an admin scans before the name, so it also carries the accessible
  // label: a phone icon beside "iPad Air" would misidentify the device being revoked.
  function deviceTypeLabel(type: DeviceType): string {
    if (type === DEVICE_TYPES.tablet) return t("devices.typeTablet");
    if (type === DEVICE_TYPES.desktop) return t("devices.typeDesktop");
    return t("devices.typePhone");
  }

  return (
    <div>
      <h1 className="text-title text-text-1">
        {t("devices.title", { count: devices.length || MAX_TRUSTED_DEVICES })}
      </h1>
      <p className="mt-s2 text-body text-text-2">{t("devices.body")}</p>

      <ul className="mt-s5 list-none p-0">
        {devices.map((device) => (
          <li
            key={device.id}
            className="flex min-h-row-72 items-center gap-s3 border-b border-border-subtle"
          >
            <Icon
              glyph={DEVICE_GLYPHS[device.type]}
              size="lg"
              className="text-text-2"
              label={deviceTypeLabel(device.type)}
            />
            <span className="flex grow flex-col">
              <span className="text-emph text-text-1">{device.name}</span>
              <span className="text-caption text-text-3">
                {t("devices.lastUsed", { when: device.lastUsedLabel, location: device.location })}
              </span>
            </span>
            <Button
              variant="textDanger"
              size="inline"
              isLoading={revokingDeviceId === device.id}
              disabled={revokingDeviceId !== null}
              onClick={() => onRevoke(device.id)}
            >
              {t("devices.revoke")}
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-s5 text-center">
        <Button variant="text" size="secondary" onClick={onCancel}>
          {tShell("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
