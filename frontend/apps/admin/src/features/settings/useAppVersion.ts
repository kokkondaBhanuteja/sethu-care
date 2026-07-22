import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { fetchAppVersion } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";
import type { AppVersion } from "./settings.types";

/** The build never changes inside a session, so it is fetched once and kept. */
const VERSION_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/**
 * App / build / environment / bundle, plus the one-tap copy (spec §6.33). The first question in any
 * support conversation is "what version are you on?", and reading four values down a phone line at
 * 2am is where the mistakes happen.
 */
export function useAppVersion() {
  const { t } = useTranslation("adminSettings");

  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.version,
    queryFn: ({ signal }) => fetchAppVersion(signal),
    staleTime: VERSION_STALE_TIME_MS,
  });

  const copyVersion = async (version: AppVersion) => {
    const details = [
      `${t("support.versionApp")}: ${version.app}`,
      `${t("support.versionBuild")}: ${version.build}`,
      `${t("support.versionEnvironment")}: ${version.environment}`,
      `${t("support.versionBundle")}: ${version.bundle}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(details);
      showToast({ message: t("support.versionCopied"), tone: TOAST_TONES.success });
    } catch {
      // Clipboard access is denied in some embedded webviews; say so rather than failing silently.
      showToast({ message: t("support.versionCopyFailed"), tone: TOAST_TONES.danger });
    }
  };

  return { query, copyVersion };
}
