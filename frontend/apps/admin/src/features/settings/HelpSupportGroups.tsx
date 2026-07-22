import { LifeBuoy, Radar, Scale, Wrench, Zap } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { ROUTES } from "../../routes/routes.constants";
import { SettingsCard, SettingsGroup, SettingsNote } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/**
 * The three Help groups both surfaces share (BOX 65 / 104), so the ways to reach a human, the
 * diagnostics consent wording and the legal credits can never diverge between desktop and phone.
 */
export function HelpGetHelpGroup() {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={t("support.groupGetHelp")} icon={LifeBuoy}>
      <SettingsCard>
        <SettingsRow
          height="list"
          icon={Radar}
          label={t("support.contactEngineering")}
          detail={t("support.contactEngineeringHint")}
          to={ROUTES.tickets}
        />
        {/* The status page is published outside this repo and has no address in the app's
            configuration yet, so the row names it without promising a link. */}
        <SettingsRow height="list" icon={Zap} label={t("support.knownIssues")} />
      </SettingsCard>
    </SettingsGroup>
  );
}

export interface HelpDiagnosticsGroupProps {
  onSend: () => void;
  isSending: boolean;
  /** Desktop's consent note names a browser; the phone's names a device. */
  wide?: boolean;
}

export function HelpDiagnosticsGroup({
  onSend,
  isSending,
  wide = false,
}: HelpDiagnosticsGroupProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={t("support.groupDiagnostics")} icon={Wrench}>
      <SettingsCard>
        <SettingsRow
          label={t("support.sendDiagnostics")}
          onClick={onSend}
          affordance={isSending ? "none" : "auto"}
        />
        <SettingsNote>
          {wide ? t("support.diagnosticsNoteDesktop") : t("support.diagnosticsNote")}
        </SettingsNote>
      </SettingsCard>
    </SettingsGroup>
  );
}

export function HelpLegalGroup() {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup title={t("support.groupLegal")} icon={Scale}>
      <SettingsCard>
        {/* The legal documents are published outside this repo and no address for them exists in
            the app's configuration yet, so the rows state what exists without promising a link. */}
        <SettingsRow height="compact" label={t("support.terms")} />
        <SettingsRow height="compact" label={t("support.privacy")} />
        <SettingsRow height="compact" label={t("support.licences")} />
        {/* Flaticon free-tier attribution — required by the artwork licence
            (ENGINEERING-STANDARDS Part 6; assets/CLAUDE.md is the per-asset registry). */}
        <SettingsRow height="compact" label={t("support.artworkCredit")} />
      </SettingsCard>
    </SettingsGroup>
  );
}
