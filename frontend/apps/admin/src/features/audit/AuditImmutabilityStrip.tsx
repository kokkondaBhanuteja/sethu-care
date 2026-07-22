import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";

export interface AuditImmutabilityStripProps {
  /** Desktop states the full rule; mobile states the short form (BOX 48 vs BOX 75). */
  variant: "desktop" | "mobile";
}

/**
 * The rule, stated before the data. The screen carries no edit, delete, export or overflow control
 * anywhere — the log is append-only and a correction is a new compensating entry, never a mutation
 * (spec §10.1, §10.4; BOX 48/50). An absence that large has to be said out loud, or it reads as an
 * oversight rather than as the guarantee it is.
 */
export function AuditImmutabilityStrip({ variant }: AuditImmutabilityStripProps) {
  const { t } = useTranslation("adminAudit");

  return (
    <Banner
      tone="info"
      icon={Lock}
      title={variant === "desktop" ? t("immutability.desktop") : t("immutability.mobile")}
    />
  );
}
