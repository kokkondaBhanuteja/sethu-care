import { Ban } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../../components/ui/Pill";
import { StatusDot } from "../../../components/ui/StatusDot";
import type { AvatarStatus } from "../../../components/ui/Avatar";
import type { DotTone } from "../../../components/ui/StatusDot";
import { PROVIDER_STATUSES, type ProviderStatus } from "../providers.types";

const STATUS_LABEL_KEYS = {
  [PROVIDER_STATUSES.free]: "status.free",
  [PROVIDER_STATUSES.onJob]: "status.onJob",
  [PROVIDER_STATUSES.offline]: "status.offline",
  [PROVIDER_STATUSES.suspended]: "status.suspended",
  [PROVIDER_STATUSES.offboarded]: "status.offboarded",
} as const;

const DOT_TONE: Readonly<Record<ProviderStatus, DotTone>> = {
  [PROVIDER_STATUSES.free]: "success",
  [PROVIDER_STATUSES.onJob]: "warning",
  [PROVIDER_STATUSES.offline]: "neutral",
  [PROVIDER_STATUSES.suspended]: "danger",
  [PROVIDER_STATUSES.offboarded]: "neutral",
};

const DOT_FILL: Readonly<Record<ProviderStatus, "solid" | "half" | "hollow">> = {
  [PROVIDER_STATUSES.free]: "solid",
  [PROVIDER_STATUSES.onJob]: "half",
  [PROVIDER_STATUSES.offline]: "hollow",
  [PROVIDER_STATUSES.suspended]: "solid",
  [PROVIDER_STATUSES.offboarded]: "hollow",
};

export const AVATAR_STATUS_FOR_PROVIDER: Readonly<Record<ProviderStatus, AvatarStatus>> = {
  [PROVIDER_STATUSES.free]: "online",
  [PROVIDER_STATUSES.onJob]: "busy",
  [PROVIDER_STATUSES.offline]: "offline",
  [PROVIDER_STATUSES.suspended]: "suspended",
  [PROVIDER_STATUSES.offboarded]: "offline",
};

export function useProviderStatusLabel(): (status: ProviderStatus) => string {
  const { t } = useTranslation("adminProviders");
  return (status) => t(STATUS_LABEL_KEYS[status]);
}

export interface ProviderStatusIndicatorProps {
  status: ProviderStatus;
}

/**
 * Dot plus word, always. A suspension is a standing decision rather than a live signal, so it
 * swaps the dot for a labelled pill: the one provider who cannot be dispatched has to be
 * unmistakable, and colour alone would not say it (spec §4.8).
 */
export function ProviderStatusIndicator({ status }: ProviderStatusIndicatorProps) {
  const label = useProviderStatusLabel()(status);

  if (status === PROVIDER_STATUSES.suspended || status === PROVIDER_STATUSES.offboarded) {
    return (
      <Pill tone={status === PROVIDER_STATUSES.suspended ? "danger" : "neutral"} icon={Ban}>
        {label}
      </Pill>
    );
  }

  return <StatusDot tone={DOT_TONE[status]} fill={DOT_FILL[status]} label={label} visualLabel />;
}
