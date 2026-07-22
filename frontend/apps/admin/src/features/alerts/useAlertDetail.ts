import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, normalizeError } from "../../lib/http/apiError";
import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { addAlertNote, fetchAlertDetail } from "./alerts.api";
import { ALERTS_QUERY_KEYS } from "./alerts.constants";
import type { AlertDetail } from "./alerts.types";
import { useAcknowledgeAlert, type AcknowledgeController } from "./useAcknowledgeAlert";

export interface AlertDetailController {
  readonly query: UseQueryResult<AlertDetail>;
  /** `/alerts/:id` is a push-notification target: a deleted alert renders, it never crashes (§3.4). */
  readonly isNotFound: boolean;
  readonly acknowledgement: AcknowledgeController;
  addNote: (body: string) => void;
  readonly isAddingNote: boolean;
}

export function useAlertDetail(alertId: string): AlertDetailController {
  const { t } = useTranslation("adminAlerts");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ALERTS_QUERY_KEYS.detail(alertId),
    queryFn: ({ signal }) => fetchAlertDetail(alertId, signal),
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => addAlertNote(alertId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEYS.detail(alertId) });
      showToast({ message: t("toast.noteAdded"), tone: TOAST_TONES.success });
    },
  });

  const acknowledgement = useAcknowledgeAlert();

  const { mutate: mutateNote } = noteMutation;
  const addNote = useCallback((body: string) => mutateNote(body), [mutateNote]);

  const isNotFound =
    query.isError && normalizeError(query.error, "").code === API_ERROR_CODES.notFound;

  return {
    query,
    isNotFound,
    acknowledgement,
    addNote,
    isAddingNote: noteMutation.isPending,
  };
}
