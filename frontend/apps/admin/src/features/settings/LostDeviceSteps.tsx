import { useTranslation } from "@sethu/i18n";

import { LOST_DEVICE_STEP_KEYS } from "./settings.constants";

/**
 * The lost-device runbook (spec §5.7). The ORDER of the four steps is the advice — sign out
 * everywhere first, because revoking one device while other sessions live achieves nothing — so it
 * is an ordered list, not four bullets.
 */
export function LostDeviceSteps() {
  const { t } = useTranslation("adminSettings");

  return (
    <ol className="flex list-decimal flex-col gap-s3 pl-s5 text-label text-text-1 marker:font-bold marker:text-text-2">
      {LOST_DEVICE_STEP_KEYS.map((stepKey) => (
        <li key={stepKey}>{t(stepKey)}</li>
      ))}
    </ol>
  );
}
