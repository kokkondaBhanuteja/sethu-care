import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "@sethu/i18n";

import { showToast, TOAST_TONES } from "../../lib/toast/toastStore";
import { fetchAlerts, markInformationalRead } from "./alerts.api";
import { ALERTS_QUERY_KEYS, SEVERITY_FILTER_ALL, type SeverityFilter } from "./alerts.constants";
import type { Alert } from "./alerts.types";
import { useAcknowledgeAlert, type AcknowledgeController } from "./useAcknowledgeAlert";

/** The feed is the console's second-most-watched screen; a stale critical is the one that hurts. */
const REFETCH_INTERVAL_MS = 30_000;

export interface AlertsFeedController {
  readonly query: UseQueryResult<readonly Alert[]>;
  readonly severityFilter: SeverityFilter;
  setSeverityFilter: (filter: SeverityFilter) => void;
  readonly isFiltered: boolean;
  clearFilters: () => void;
  readonly acknowledgement: AcknowledgeController;
  markRead: () => void;
  readonly isMarkingRead: boolean;
}

/**
 * Everything both feed shells need, in one place. The desktop and mobile screens differ in layout
 * only — filtering, acknowledgement and mark-read behave identically, and keeping that here is what
 * stops the two surfaces drifting apart (spec §2.1).
 */
export function useAlertsFeed(): AlertsFeedController {
  const { t } = useTranslation("adminAlerts");
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(SEVERITY_FILTER_ALL);

  const query = useQuery({
    queryKey: ALERTS_QUERY_KEYS.feed(),
    queryFn: ({ signal }) => fetchAlerts(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const acknowledgement = useAcknowledgeAlert();

  // "Mark read" can only ever touch the informational tier. Bulk-acknowledging criticals would
  // defeat the mechanism the whole screen exists to protect (spec §6.20).
  const markReadMutation = useMutation({
    mutationFn: () => markInformationalRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEYS.root });
      showToast({ message: t("toast.markedRead"), tone: TOAST_TONES.success });
    },
  });

  const { mutate: mutateMarkRead } = markReadMutation;
  const markRead = useCallback(() => mutateMarkRead(), [mutateMarkRead]);
  const clearFilters = useCallback(() => setSeverityFilter(SEVERITY_FILTER_ALL), []);

  return {
    query,
    severityFilter,
    setSeverityFilter,
    isFiltered: severityFilter !== SEVERITY_FILTER_ALL,
    clearFilters,
    acknowledgement,
    markRead,
    isMarkingRead: markReadMutation.isPending,
  };
}
