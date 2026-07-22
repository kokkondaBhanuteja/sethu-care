import { CheckCircle2, Info, Monitor, XCircle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { formatDateTime } from "../../../lib/format";
import type { ApplicationDecision, ApprovalBlocker } from "../applications.types";

/**
 * BOX 47 / M73. Placed ABOVE the action bar, never below it: a note that explains a dead control
 * has to be read before the reader reaches the control, or they hunt for the cause.
 */
export function ApproveBlockedBanner({ blocker }: { blocker: ApprovalBlocker }) {
  const { t } = useTranslation("adminProviders");
  const reason = blocker.documentKey
    ? t(blocker.messageKey, { document: t(blocker.documentKey) })
    : t(blocker.messageKey);

  return (
    <Banner tone="danger" icon={Info} title={t("review.approveBlocked", { blocker: reason })} />
  );
}

/**
 * M74. Two ops managers can open the same application at once; this is what the second one lands
 * on. It is informational, not an error — the decision was legitimate, it simply was not theirs.
 */
export function ApplicationDecidedBanner({ decision }: { decision: ApplicationDecision }) {
  const { t } = useTranslation("adminProviders");
  const isApproved = decision.outcome === "approved";

  return (
    <Banner
      tone={isApproved ? "success" : "danger"}
      icon={isApproved ? CheckCircle2 : XCircle}
      title={t(isApproved ? "review.decidedApproved" : "review.decidedRejected", {
        admin: decision.byName,
        at: formatDateTime(decision.at),
      })}
    />
  );
}

/**
 * Advice, not a block. The ops manager can still decide here; she is being told that a bigger
 * screen makes this particular judgement safer, which is honest about where document review
 * really belongs (spec §6.18).
 */
export function DesktopRecommendedCard() {
  const { t } = useTranslation("adminProviders");

  return (
    <Card tone="info">
      <div className="flex items-start gap-s2">
        <Icon glyph={Monitor} className="text-brand" />
        <div className="grow">
          <p className="text-label font-semibold text-brand">{t("review.desktopNoticeTitle")}</p>
          <p className="mt-s1 text-label text-text-1">{t("review.desktopNoticeBody")}</p>
          <Button variant="textBrand" size="inline" className="mt-s2">
            {t("review.desktopNoticeAction")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
