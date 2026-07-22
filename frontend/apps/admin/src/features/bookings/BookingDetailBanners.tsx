import type { ReactNode } from "react";
import { Info, ShieldCheck, Siren, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { Card, IconChip, cn } from "@sethu/ui-web";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { formatDate, formatDateTime, formatTime } from "../../lib/format";
import { useBookingCopy } from "./useBookingCopy";
import type {
  BookingConcurrentChange,
  BookingEscalation,
  BookingVerification,
} from "./bookings.types";

export interface ConcurrentChangeBannerProps {
  change: BookingConcurrentChange;
  onReload: () => void;
}

/**
 * Informational, not an error: the right thing happened, it just was not this user who did it. It
 * names the person, because "someone" cannot be followed up and "Priya S." can — and the screen
 * deliberately does NOT swap itself to the new data, since re-rendering under a thumb mid-tap is
 * how the wrong button gets pressed (design BOX 9 / M11).
 */
export function ConcurrentChangeBanner({ change, onReload }: ConcurrentChangeBannerProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <Banner
      tone="info"
      icon={Info}
      title={t("banner.concurrentChange", {
        provider: change.providerName,
        actor: change.actorName,
      })}
      actions={
        <Button variant="textBrand" size="inline" onClick={onReload}>
          {t("banner.reload")}
        </Button>
      }
    />
  );
}

/** Spec §3.4 rule 4 — a deep link into an action whose situation somebody already handled. */
export function ResolvedIntentBanner() {
  const { t } = useTranslation("adminBookings");
  return <Banner tone="info" icon={Info} title={t("banner.intentResolved")} />;
}

export interface EscalationBannerProps {
  escalation: BookingEscalation;
  /** Acknowledge and Assign live inline in the strip, not in a bottom bar. */
  actions?: ReactNode;
  /** The wide desktop strip states the age and the cause on one line; mobile stacks them. */
  isWide?: boolean;
}

/**
 * The exception, styled as the design's tinted danger card with a soft icon chip rather than a
 * full-bleed strip — it sits INSIDE the record's card column now, first, above everything it
 * explains. Still `role="alert"`: it is the one condition the operator must not miss.
 */
export function EscalationBanner({ escalation, actions, isWide = false }: EscalationBannerProps) {
  const { t } = useTranslation("adminBookings");
  const { escalationTitle, escalationWide } = useBookingCopy();

  return (
    <Card
      tone="danger"
      role="alert"
      className={cn("flex flex-wrap items-start gap-3 p-4", !isWide && "mx-s4 my-s2")}
    >
      <IconChip size="sm" look="soft" className="bg-danger-bg text-danger-fg">
        <Icon glyph={Siren} />
      </IconChip>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold text-danger-fg">
          {isWide
            ? escalationWide(escalation.minutesUnresolved, escalation.rounds)
            : escalationTitle(escalation.minutesUnresolved)}
        </span>
        {isWide ? null : (
          <span className="text-label text-text-2">
            {t("banner.escalatedDetail", { rounds: escalation.rounds })}
          </span>
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </Card>
  );
}

export interface VerificationBannerProps {
  verification: BookingVerification;
}

/**
 * The accountability trail behind an admin-asserted completion: who verified it, when, and the
 * deadline by which it can still be challenged. Amber rather than green because that last date is
 * the point — the record is not closed yet.
 */
export function VerificationBanner({ verification }: VerificationBannerProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <Banner
      tone="warning"
      icon={ShieldCheck}
      title={t("banner.verification", {
        name: verification.verifiedByName,
        verifiedAt: formatDateTime(verification.verifiedAt),
        closesAt: `${formatDate(verification.disputeWindowClosesAt)} ${formatTime(verification.disputeWindowClosesAt)}`,
      })}
    />
  );
}

export interface OfflineDetailBannerProps {
  /** When the cached copy was taken — the operator needs to know how old what they read is. */
  cachedAt: string;
}

export function OfflineDetailBanner({ cachedAt }: OfflineDetailBannerProps) {
  const { t } = useTranslation("adminBookings");
  return (
    <Banner
      tone="warning"
      icon={WifiOff}
      title={t("banner.offlineDetailTitle", { time: formatTime(cachedAt) })}
    />
  );
}
