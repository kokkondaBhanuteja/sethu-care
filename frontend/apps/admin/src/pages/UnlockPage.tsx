import { useIsDesktop } from "../hooks/useBreakpoint";
import { BiometricUnlockMobile } from "../features/auth/BiometricUnlock.mobile";
import { SessionLockDesktop } from "../features/auth/SessionLock.desktop";
import { useSessionLock } from "../features/auth/useSessionLock";
import { useUnlock } from "../features/auth/useUnlock";

/**
 * `/unlock` — re-verify identity without a full login.
 *
 * A browser has no fingerprint sensor, so the two shells run different step-ups: desktop re-asks
 * for the password behind a non-dismissible modal (design BOX 58), a phone asks the sensor and
 * falls back to the device passcode (spec §5.4, design BOX 92–94).
 */
export default function UnlockPage() {
  const isDesktop = useIsDesktop();

  return isDesktop ? <DesktopLock /> : <MobileUnlock />;
}

function DesktopLock() {
  return <SessionLockDesktop lock={useSessionLock()} />;
}

function MobileUnlock() {
  return <BiometricUnlockMobile unlock={useUnlock()} />;
}
