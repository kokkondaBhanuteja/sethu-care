import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { formatDate } from "../../../lib/format";
import type { ProviderProfile } from "../providers.types";
import type { ProviderProfileScreen } from "../hooks/useProviderProfile";
import { SectionGap } from "../../../layouts/Layout";
import { ProviderDocumentList } from "./ProviderDocumentList";
import { ProviderLiveCard } from "./ProviderLiveCard";
import { ProviderMetrics } from "./ProviderMetrics";
import { ProviderRecentJobsList } from "./ProviderRecentJobs";
import { ProviderFeedbackCard, ProviderFlagsCard } from "./ProviderSideCards";
import { ProviderSkillsCard } from "./ProviderSkillsCard";
import { SectionLabel } from "./SectionLabel";

export interface ProviderProfileSectionsProps {
  profile: ProviderProfile;
  screen: ProviderProfileScreen;
}

/** The scrolling body of the mobile profile, in the order M65 stacks it. */
export function ProviderProfileSections({ profile, screen }: ProviderProfileSectionsProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <>
      {screen.expiredDocument ? (
        <div className="px-s4 pb-s4">
          <Card tone="danger">
            <div className="flex items-start gap-s2">
              <Icon glyph={AlertTriangle} className="text-danger" />
              <span className="grow text-label text-danger">
                {t("profile.expiryBanner", {
                  document: t(screen.expiredDocument.typeKey),
                  date: screen.expiredDocument.expiresAt
                    ? formatDate(screen.expiredDocument.expiresAt)
                    : "",
                })}
              </span>
            </div>
            {screen.canSuspend ? (
              <Button
                variant="danger"
                size="inline"
                className="mt-s3"
                onClick={screen.openSuspendFlow}
              >
                {t("profile.expiryAction")}
              </Button>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div className="px-s4 pb-s4">
        <ProviderFlagsCard flags={profile.flags} metrics={profile.metrics} />
      </div>

      <div className="px-s4 pb-s4">
        <ProviderLiveCard
          profile={profile}
          variant="mobile"
          hasExpiredCredential={Boolean(screen.expiredDocument)}
        />
      </div>

      <SectionGap />
      <ProviderMetrics metrics={profile.metrics} variant="mobile" />

      <SectionGap />
      <ProviderSkillsCard skills={profile.skills} bare />

      <SectionGap />
      <div className="py-s4">
        <SectionLabel className="mb-s2 px-s4">{t("profile.documents")}</SectionLabel>
        <div className="px-s4">
          <ProviderDocumentList documents={profile.documents} />
        </div>
        <p className="px-s4 pt-s2 text-caption text-text-3">{t("profile.documentsFootMobile")}</p>
      </div>

      <SectionGap />
      <ProviderRecentJobsList jobs={profile.recentJobs} />

      <SectionGap />
      <ProviderFeedbackCard feedback={profile.feedback} bare />
    </>
  );
}
