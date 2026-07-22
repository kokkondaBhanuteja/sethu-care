import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Skeleton } from "../../components/ui/Skeleton";
import { HelpFaqGroup } from "./HelpFaqGroup";
import { HelpDiagnosticsGroup, HelpGetHelpGroup, HelpLegalGroup } from "./HelpSupportGroups";
import { HelpVersionCard } from "./HelpVersionCard";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsShell } from "./SettingsShell";
import { SETTINGS_SECTION_IDS } from "./settings.constants";
import { useAppVersion } from "./useAppVersion";
import { useDiagnostics } from "./useDiagnostics";

/**
 * BOX 65 inside the unified Settings frame, in support-conversation order: the questions an admin
 * can answer alone, the ways to reach a human, then the version block — outlined, because "what
 * build are you on?" is the first thing support asks — diagnostics and the legal credits.
 */
export function HelpSupportDesktop() {
  const { query, copyVersion } = useAppVersion();
  const { sendDiagnostics, isSending } = useDiagnostics();

  return (
    <SettingsShell section={SETTINGS_SECTION_IDS.help}>
      <HelpFaqGroup />

      <HelpGetHelpGroup />

      <SettingsGroup>
        <QueryBoundary query={query} skeleton={<Skeleton className="h-row-72" />}>
          {(version) => (
            <HelpVersionCard version={version} outlined onCopy={() => void copyVersion(version)} />
          )}
        </QueryBoundary>
      </SettingsGroup>

      <HelpDiagnosticsGroup onSend={() => void sendDiagnostics()} isSending={isSending} wide />

      <HelpLegalGroup />
    </SettingsShell>
  );
}
