import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { fetchAppVersion } from "./settings.api";

/**
 * Send diagnostics (spec §6.33). The consent notice next to the button lists exactly what is
 * uploaded, including the sentence that no customer data is included — consent that is not informed
 * is not consent, and §5.6 forbids customer PII from ever leaving the active session.
 *
 * There is no upload endpoint yet: the button reads the build so the success toast can quote it,
 * which is the number support asks for next.
 */
export function useDiagnostics() {
  const { t } = useTranslation("adminSettings");
  const [isSending, setIsSending] = useState(false);

  const sendDiagnostics = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const version = await fetchAppVersion();
      showToast({
        message: t("support.diagnosticsSent", { build: version.build }),
        tone: TOAST_TONES.success,
      });
    } catch {
      showToast({ message: t("support.diagnosticsFailed"), tone: TOAST_TONES.danger });
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendDiagnostics };
}
