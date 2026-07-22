import { KeyRound, Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { formatDate } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { useSignOut } from "./useSignOut";
import type { SecuritySettings } from "./settings.types";

export interface SecuritySessionGroupsProps {
  security: SecuritySettings;
  /** Desktop lays the two groups side by side; mobile stacks them. */
  side?: boolean;
}

/**
 * Sessions and password (spec §6.31). "Sign out everywhere" is the first step of the lost-device
 * runbook (§5.7), which is why it sits here rather than behind the sign-out confirm in More: it
 * ends every session on every device, including the ones the admin no longer holds.
 */
export function SecuritySessionGroups({ security, side = false }: SecuritySessionGroupsProps) {
  const { t } = useTranslation("adminSettings");
  const { signOut } = useSignOut();

  const sessions = (
    <SettingsGroup
      title={t("security.groupSessions")}
      icon={KeyRound}
      className={side ? "mb-0 px-0" : undefined}
    >
      <SettingsCard>
        <SettingsRow
          height="list"
          label={t("security.activeSessions")}
          value={String(security.activeSessions)}
        />
        <SettingsRow
          height="list"
          label={t("security.signOutEverywhere")}
          tone="danger"
          affordance="none"
          onClick={() => void signOut()}
        />
      </SettingsCard>
    </SettingsGroup>
  );

  const password = (
    <SettingsGroup
      title={t("security.groupPassword")}
      icon={Lock}
      className={side ? "mb-0 px-0" : undefined}
    >
      <SettingsCard>
        <SettingsRow
          height="list"
          label={t("security.changePassword")}
          detail={t("security.changePasswordHint")}
          // Password changes happen in the web account flow, not in this console; on native the row
          // opens it through `@capacitor/browser`. Until that flow has a route of its own it points
          // at the login screen, which owns account recovery.
          to={ROUTES.login}
          external
        />
        <SettingsRow
          height="list"
          label={t("security.lastChanged")}
          value={formatDate(security.passwordChangedAtIso)}
        />
      </SettingsCard>
    </SettingsGroup>
  );

  if (!side) {
    return (
      <>
        {sessions}
        {password}
      </>
    );
  }

  return (
    <div className="mb-s5 grid grid-cols-2 gap-s5 px-s4">
      {sessions}
      {password}
    </div>
  );
}
