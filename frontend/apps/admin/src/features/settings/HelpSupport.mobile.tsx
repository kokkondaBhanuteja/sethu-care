import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Skeleton } from "../../components/ui/Skeleton";
import { HelpFaqGroup } from "./HelpFaqGroup";
import { HelpDiagnosticsGroup, HelpGetHelpGroup, HelpLegalGroup } from "./HelpSupportGroups";
import { HelpVersionCard } from "./HelpVersionCard";
import { SettingsGroup, SettingsLead } from "./SettingsGroup";
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
        <SettingsLead>{t("sections.helpDescription")}</SettingsLead>

        <HelpFaqGroup />

        <HelpGetHelpGroup />

        <SettingsGroup>
          <QueryBoundary query={query} skeleton={<Skeleton className="h-row-72" />}>
            {(version) => (
              <HelpVersionCard version={version} onCopy={() => void copyVersion(version)} />
            )}
          </QueryBoundary>
        </SettingsGroup>

        <HelpDiagnosticsGroup onSend={() => void sendDiagnostics()} isSending={isSending} />

        <HelpLegalGroup />
      </div>
    </>
  );
}
