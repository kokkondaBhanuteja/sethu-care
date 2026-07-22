import { Activity } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { StatusDot } from "../../../components/ui/StatusDot";
import { formatMoney } from "../../../lib/format";
import { PROVIDER_STATUSES, type ProviderProfile } from "../providers.types";
import { LocationThumb } from "./LocationThumb";
import { useProviderStatusLabel } from "./ProviderStatusIndicator";

export interface ProviderLiveCardProps {
  profile: ProviderProfile;
  /** Desktop gives the map a full-width panel; mobile tucks a small thumb beside the text. */
  variant: "desktop" | "mobile";
}

/**
 * What this provider may do right now, under a soft-blue Activity header. A suspended record
 * drops "Available · Kompally" outright: a provider cannot be both suspended and available, and
 * leaving the line would have the screen contradict its own banner three hundred pixels apart
 * (BOX 39).
 */
export function ProviderLiveCard({ profile, variant }: ProviderLiveCardProps) {
  const { t } = useTranslation("adminProviders");
  const statusLabel = useProviderStatusLabel()(profile.status);
  const isSuspended = profile.status === PROVIDER_STATUSES.suspended;

  function headline(): string {
    if (isSuspended) return t("profile.liveSuspended");
    if (profile.status === PROVIDER_STATUSES.onJob) {
      return t("profile.liveOnJob", { zone: profile.zone });
    }
    if (profile.status === PROVIDER_STATUSES.free) {
      return t("profile.liveAvailable", { zone: profile.zone });
    }
    return t("profile.liveOffline", { zone: profile.zone });
  }

  function subline(): string {
    if (isSuspended) return t("profile.liveSuspendedMeta", { zone: profile.zone });
    return t("profile.liveMeta", {
      count: profile.jobsToday,
      earnings: formatMoney(profile.earningsTodayPaise),
    });
  }

  return (
    <Card density="flush">
      <CardHeader
        icon={
          <IconChip accent="blue" look="soft">
            <Activity aria-hidden />
          </IconChip>
        }
        actions={
          <StatusDot
            tone={isSuspended ? "neutral" : "success"}
            fill={isSuspended ? "hollow" : "solid"}
            size="sm"
            pulse={!isSuspended}
            label={statusLabel}
          />
        }
      >
        {t("profile.live")}
      </CardHeader>

      <CardContent>
        <div className="flex items-start gap-3">
          <div className="min-w-0 grow">
            <p className="text-sm font-medium text-ink">{headline()}</p>
            <p className="mt-1 text-sm text-muted">{subline()}</p>
          </div>
          {variant === "mobile" ? (
            <LocationThumb
              status={profile.status}
              label={t("profile.locationLabel")}
              size="thumb"
            />
          ) : null}
        </div>

        {variant === "desktop" ? (
          <LocationThumb
            status={profile.status}
            label={t("profile.locationLabel")}
            className="mt-3"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
