import { FileText } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Card } from "../../components/ui/Card";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { PageMain } from "../../layouts/PageMain";
import {
  ExpiredDocumentBanner,
  OffboardedBanner,
  SuspensionBanner,
} from "./components/ProviderBanners";
import { ProviderDocumentList } from "./components/ProviderDocumentList";
import { ProviderLiveCard } from "./components/ProviderLiveCard";
import { ProviderMetrics } from "./components/ProviderMetrics";
import { ProviderRecentJobsTable } from "./components/ProviderRecentJobs";
import { ProviderRecordHead } from "./components/ProviderRecordHead.desktop";
import {
  ProviderFeedbackCard,
  ProviderFlagsCard,
  ProviderPayoutsCard,
} from "./components/ProviderSideCards";
import { ProviderSkillsCard } from "./components/ProviderSkillsCard";
import { useProviderProfile } from "./hooks/useProviderProfile";

/**
 * BOX 39–42. Three columns: what he may do right now, how well he has been doing it, and what
 * customers said about it. Recent jobs sits full-width BELOW the 25/45/30 grid: inside the middle
 * column the six-column table clipped its Rating and Amount columns at 1440, and the money column
 * must be readable without a horizontal scroll.
 */
export function ProviderProfileDesktop() {
  const { t } = useTranslation("adminProviders");
  const screen = useProviderProfile();
  const profile = screen.query.data ?? null;

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("profile.breadcrumb"), to: ROUTES.providers },
          { label: profile?.name ?? screen.providerId },
        ]}
      />

      {profile?.suspension ? <SuspensionBanner suspension={profile.suspension} /> : null}
      {profile?.offboardedAt ? <OffboardedBanner offboardedAt={profile.offboardedAt} /> : null}
      {profile ? <ProviderRecordHead profile={profile} screen={screen} /> : null}
      {screen.expiredDocument ? (
        <ExpiredDocumentBanner
          document={screen.expiredDocument}
          {...(screen.canSuspend ? { onSuspend: screen.openSuspendFlow } : {})}
        />
      ) : null}

      <QueryBoundary
        query={screen.query}
        isEmpty={(loaded) => loaded === null}
        empty={<NotFoundState subject={t("profile.notFound")} />}
        skeleton={
          <PageMain>
            <SkeletonList rows={6} rowClassName="h-row-72" label={t("profile.loadingLabel")} />
          </PageMain>
        }
      >
        {(loaded) =>
          loaded === null ? null : (
            <PageMain>
              <div className="grid grid-cols-1 gap-s5 lg:grid-cols-20">
                <div className="flex flex-col gap-s5 lg:col-span-5">
                  <ProviderLiveCard
                    profile={loaded}
                    variant="desktop"
                    hasExpiredCredential={Boolean(screen.expiredDocument)}
                  />
                  <ProviderSkillsCard skills={loaded.skills} />
                  <Card density="flush">
                    <CardHeader
                      icon={
                        <IconChip accent="amber" look="soft">
                          <FileText aria-hidden />
                        </IconChip>
                      }
                    >
                      {t("profile.documents")}
                    </CardHeader>
                    <CardContent>
                      <ProviderDocumentList documents={loaded.documents} />
                      <p className="mt-3 text-sm text-faint">{t("profile.documentsFootDesktop")}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-s5 lg:col-span-9">
                  <ProviderMetrics metrics={loaded.metrics} variant="desktop" />
                </div>

                <div className="flex flex-col gap-s5 lg:col-span-6">
                  <ProviderFlagsCard flags={loaded.flags} metrics={loaded.metrics} />
                  <ProviderFeedbackCard feedback={loaded.feedback} />
                  <ProviderPayoutsCard amountPaise={loaded.payoutCyclePaise} />
                </div>
              </div>

              <div className="mt-s5">
                <ProviderRecentJobsTable jobs={loaded.recentJobs} />
              </div>
            </PageMain>
          )
        }
      </QueryBoundary>
    </>
  );
}
