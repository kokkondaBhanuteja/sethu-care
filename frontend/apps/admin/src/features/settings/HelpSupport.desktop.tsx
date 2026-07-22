import { Radar, Send, Zap } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Topbar } from "../../layouts/Topbar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ROUTES } from "../../routes/routes.constants";
import { HelpFaqGroup } from "./HelpFaqGroup";
import { HelpVersionCard } from "./HelpVersionCard";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { useAppVersion } from "./useAppVersion";
import { useDiagnostics } from "./useDiagnostics";
import { useSettingsCrumbs } from "./useSettingsCrumbs";

/**
 * BOX 65 — 960px rather than 720: the questions and the version block are read for different
 * reasons and there is no order between them, so they sit side by side instead of forcing a scroll
 * past six accordion rows to reach a build number support asks for first.
 */
export function HelpSupportDesktop() {
  const { t } = useTranslation("adminSettings");
  const { query, copyVersion } = useAppVersion();
  const { sendDiagnostics, isSending } = useDiagnostics();
  const crumbs = useSettingsCrumbs(t("support.title"));

  return (
    <>
      <Topbar crumbs={crumbs} />

      <main className="main">
        <div className="settings-col settings-col--960">
          <div className="grid grid-cols-3 gap-s5">
            <div className="col-span-2">
              <HelpFaqGroup />

              <SettingsGroup title={t("support.groupGetHelp")}>
                <SettingsCard>
                  <SettingsRow
                    height="list"
                    icon={Radar}
                    label={t("support.contactEngineering")}
                    detail={t("support.contactEngineeringHint")}
                    to={ROUTES.tickets}
                  />
                  {/* The status page is published outside this repo and has no address in the
                      app's configuration yet, so the row names it without promising a link. */}
                  <SettingsRow height="list" icon={Zap} label={t("support.knownIssues")} />
                </SettingsCard>
              </SettingsGroup>
            </div>

            <div className="flex flex-col gap-s5">
              <QueryBoundary query={query} skeleton={<Skeleton className="h-row-72" />}>
                {(version) => (
                  <HelpVersionCard
                    version={version}
                    outlined
                    onCopy={() => void copyVersion(version)}
                  />
                )}
              </QueryBoundary>

              <Card>
                <p className="mb-s3 text-pill uppercase tracking-wider text-text-3">
                  {t("support.sendDiagnostics")}
                </p>
                <Button
                  variant="outline"
                  size="inline"
                  block
                  iconStart={Send}
                  isLoading={isSending}
                  onClick={() => void sendDiagnostics()}
                >
                  {t("support.sendDiagnostics")}
                </Button>
                <p className="mt-s3 text-caption text-text-2">
                  {t("support.diagnosticsNoteDesktop")}
                </p>
              </Card>

              <div className="flex flex-col gap-s3 px-s1 text-label text-text-2">
                <span>{t("support.terms")}</span>
                <span>{t("support.privacy")}</span>
                <span>{t("support.licences")}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
