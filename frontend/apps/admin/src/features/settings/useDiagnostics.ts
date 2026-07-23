import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, isApiError } from "../../lib/http/apiError";
import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { fetchAppVersion, submitDiagnostics } from "./settings.api";

/**
 * Send diagnostics (spec §6.33). The consent notice next to the button lists exactly what is
 * uploaded, including the sentence that no customer data is included — consent that is not informed
 * is not consent, and §5.6 forbids customer PII from ever leaving the active session.
 *
 * The build is read first so the success toast can quote it (the number support asks for next),
 * then the payload is uploaded. A 422 is the server refusing a payload that carried customer PII —
 * surfaced as its own rejection, never retried silently.
 */
export function useDiagnostics() {
  const { t } = useTranslation("adminSettings");
  const [isSending, setIsSending] = useState(false);

  const sendDiagnostics = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const version = await fetchAppVersion();
      await submitDiagnostics(version);
      showToast({
        message: t("support.diagnosticsSent", { build: version.build }),
        tone: TOAST_TONES.success,
      });
    } catch (thrown) {
      const isPiiRejection = isApiError(thrown) && thrown.code === API_ERROR_CODES.validation;
      showToast({
        message: t(isPiiRejection ? "support.diagnosticsRejected" : "support.diagnosticsFailed"),
        tone: TOAST_TONES.danger,
      });
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendDiagnostics };
}
