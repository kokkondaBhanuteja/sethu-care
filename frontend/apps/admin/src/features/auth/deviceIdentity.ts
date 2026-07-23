// Device identity for the trusted-device model (spec §5.3, §5.6).
//
// The id must survive a restart or every reload would look like a new device to the server and
// burn a trust slot. It persists through the @sethu/core storage adapter — the same adapter the
// session token uses: localStorage on plain web today, the native-backed adapter (Preferences
// behind the OS keystore, §5.6) once the Capacitor bridge lands, with no change here.
//
// It is never derived from IMEI or an advertising id — that is a §5.6 requirement, not a detail.

import { loadPreference, savePreference } from "@sethu/core";

const DEVICE_ID_KEY = "sethu.admin.deviceId";
const DEVICE_ID_PREFIX = "dev_";

function randomDeviceId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${DEVICE_ID_PREFIX}${uuid ?? Math.random().toString(36).slice(2, 14)}`;
}

let cachedDeviceId: string | null = null;

/** The stable per-browser device id: read from storage once, minted and persisted when absent. */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await loadPreference(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  const minted = randomDeviceId();
  cachedDeviceId = minted;
  await savePreference(DEVICE_ID_KEY, minted);
  return minted;
}

const PLATFORM_LABELS: readonly (readonly [RegExp, string])[] = [
  [/iPad/i, "iPad"],
  [/iPhone/i, "iPhone"],
  [/Android/i, "Android device"],
  [/Macintosh/i, "Mac"],
  [/Windows/i, "Windows PC"],
];

/**
 * A human label for the device row in the trust list. Coarse on purpose: the row exists so an
 * admin can recognise which device to revoke, not to fingerprint the browser.
 */
export function getDeviceName(): string {
  const agent = window.navigator.userAgent;
  const match = PLATFORM_LABELS.find(([pattern]) => pattern.test(agent));
  return match ? match[1] : "Browser";
}
