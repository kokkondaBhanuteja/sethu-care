import { Radar, Zap } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Skeleton } from "../../components/ui/Skeleton";
import { ROUTES } from "../../routes/routes.constants";
import { HelpFaqGroup } from "./HelpFaqGroup";
import { HelpVersionCard } from "./HelpVersionCard";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { useAppVersion } from "./useAppVersion";
import { useDiagnostics } from "./useDiagnostics";

/** BOX 104 — questions, the way to reach a human, the version block, diagnostics, legal. */
export function HelpSupportMobile() {
  const { t } = useTranslation("adminSettings");
  const { query, copyVersion } = useAppVersion();
  const { sendDiagnostics, isSending } = useDiagnostics();

  return (
    <>
      <MobileAppBar title={t("support.title")} showBack compact onSurface />

      <div className="screen__scroll bg-surface pt-s2">
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
            {/* The status page lives outside this repo and has no address here yet, so the row
                states what it is without promising a destination it cannot reach. */}
            <SettingsRow height="list" icon={Zap} label={t("support.knownIssues")} />
          </SettingsCard>
        </SettingsGroup>

        <SettingsGroup>
          <QueryBoundary query={query} skeleton={<Skeleton className="h-row-72" />}>
            {(version) => (
              <HelpVersionCard version={version} onCopy={() => void copyVersion(version)} />
            )}
          </QueryBoundary>
        </SettingsGroup>

        <SettingsGroup title={t("support.groupDiagnostics")}>
          <SettingsCard>
            <SettingsRow
              label={t("support.sendDiagnostics")}
              onClick={() => void sendDiagnostics()}
              affordance={isSending ? "none" : "auto"}
            />
            <SettingsNote>{t("support.diagnosticsNote")}</SettingsNote>
          </SettingsCard>
        </SettingsGroup>

        <SettingsGroup title={t("support.groupLegal")}>
          <SettingsCard>
            {/* Same reason as the status page: the legal documents are published outside this
                repo and no address for them exists in the app's configuration yet. */}
            <SettingsRow height="compact" label={t("support.terms")} />
            <SettingsRow height="compact" label={t("support.privacy")} />
            <SettingsRow height="compact" label={t("support.licences")} />
            {/* Flaticon free-tier attribution — required by the artwork licence
                (ENGINEERING-STANDARDS Part 6; assets/CLAUDE.md is the per-asset registry). */}
            <SettingsRow height="compact" label={t("support.artworkCredit")} />
          </SettingsCard>
        </SettingsGroup>
      </div>
    </>
  );
}
