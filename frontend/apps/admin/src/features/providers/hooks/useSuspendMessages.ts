import { useTranslation } from "@sethu/i18n";

import { SUSPEND_REASON_LABEL_KEYS } from "../providers.constants";
import { SUSPEND_ACTION_TYPES } from "../suspend.types";
import type { SuspendActionType, SuspendReasonCode } from "../suspend.types";

export interface SuspendMessageInput {
  readonly type: SuspendActionType;
  readonly durationDays: number;
  readonly reasonCode: SuspendReasonCode | null;
  readonly providerName: string;
}

export interface SuspendMessages {
  readonly summaryHeadline: string;
  readonly reasonLabel: string;
  /** Shown verbatim, because the provider reads exactly this on their own phone (spec §6.19). */
  readonly providerMessage: string;
  readonly doneMessage: string;
}

/**
 * The three sentences the confirm step commits to, built once so the summary, the message preview
 * and the confirmation toast can never disagree about what is about to happen.
 */
export function useSuspendMessages({
  type,
  durationDays,
  reasonCode,
  providerName,
}: SuspendMessageInput): SuspendMessages {
  const { t } = useTranslation("adminProviders");
  const reasonLabel = reasonCode ? t(SUSPEND_REASON_LABEL_KEYS[reasonCode]) : "";
  const lowerReason = reasonLabel.toLowerCase();

  if (type === SUSPEND_ACTION_TYPES.block) {
    return {
      summaryHeadline: t("suspend.summaryBlock", { name: providerName }),
      reasonLabel,
      providerMessage: t("suspend.messagePreviewBlock", { reason: lowerReason }),
      doneMessage: t("suspend.doneBlocked", { name: providerName }),
    };
  }

  if (type === SUSPEND_ACTION_TYPES.forceOffline) {
    return {
      summaryHeadline: t("suspend.summaryForceOffline", { name: providerName }),
      reasonLabel,
      providerMessage: t("suspend.messagePreviewForceOffline", { reason: lowerReason }),
      doneMessage: t("suspend.doneForcedOffline", { name: providerName }),
    };
  }

  return {
    summaryHeadline: t("suspend.summarySuspend", { name: providerName, count: durationDays }),
    reasonLabel,
    providerMessage: t("suspend.messagePreviewSuspend", {
      count: durationDays,
      reason: lowerReason,
    }),
    doneMessage: t("suspend.doneSuspended", { name: providerName, count: durationDays }),
  };
}
