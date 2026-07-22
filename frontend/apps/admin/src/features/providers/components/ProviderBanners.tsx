import { AlertTriangle, Ban, History } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { formatDate } from "../../../lib/format";
import { SUSPEND_REASON_LABEL_KEYS } from "../providers.constants";
import type { ProviderDocument, ProviderProfile } from "../providers.types";

export interface SuspensionBannerProps {
  suspension: NonNullable<ProviderProfile["suspension"]>;
}

/**
 * Until when, why, and who did it. A second ops manager deciding whether to undo someone else's
 * call needs all three: an unattributed suspension is an argument waiting to happen (BOX 39).
 */
export function SuspensionBanner({ suspension }: SuspensionBannerProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Banner
      tone="danger"
      icon={Ban}
      title={t("profile.suspensionBanner", {
        date: formatDate(suspension.until),
        reason: t(SUSPEND_REASON_LABEL_KEYS[suspension.reasonCode]),
        admin: suspension.byName,
      })}
    />
  );
}

export interface ExpiredDocumentBannerProps {
  document: ProviderDocument;
  onSuspend?: () => void;
}

/**
 * The action is offered in the strip itself. Reading that a provider must not be dispatched and
 * then hunting for the Suspend button is the gap in which a booking gets assigned to him.
 */
export function ExpiredDocumentBanner({ document, onSuspend }: ExpiredDocumentBannerProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Banner
      tone="danger"
      icon={AlertTriangle}
      title={t("profile.expiryBanner", {
        document: t(document.typeKey),
        date: document.expiresAt ? formatDate(document.expiresAt) : "",
      })}
      actions={
        onSuspend ? (
          <Button variant="danger" size="inline" onClick={onSuspend}>
            {t("profile.expiryAction")}
          </Button>
        ) : undefined
      }
    />
  );
}

/** Stays at full opacity outside the dimmed body — the reason for a dimmed screen must be legible. */
export function OffboardedBanner({ offboardedAt }: { offboardedAt: string }) {
  const { t } = useTranslation("adminProviders");

  return (
    <Banner
      tone="info"
      icon={History}
      title={t("profile.offboardedBanner", { date: formatDate(offboardedAt) })}
    />
  );
}
