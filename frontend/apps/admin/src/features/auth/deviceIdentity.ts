// Device identity for the trusted-device model (spec §5.3, §5.6).
//
// GAP: this id must survive a restart, and §5.6 puts it in `@capacitor/preferences` behind the OS
// keystore. `@sethu/core` has `savePreference`/`loadPreference` for exactly that, but does not
// export them today — so the id below is regenerated per app run, which means every reload looks
// like a new device to the server. Export those two functions from `@sethu/core` and this file
// becomes a read-through cache; nothing else changes.
//
// It is never derived from IMEI or an advertising id — that is a §5.6 requirement, not a detail.

const DEVICE_ID_PREFIX = "dev_";

function randomDeviceId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${DEVICE_ID_PREFIX}${uuid ?? Math.random().toString(36).slice(2, 14)}`;
}

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  cachedDeviceId ??= randomDeviceId();
  return cachedDeviceId;
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
