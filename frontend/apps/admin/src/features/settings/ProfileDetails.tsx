import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { formatDate } from "../../lib/format";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import type { AdminProfile } from "./settings.types";

export interface ProfileDetailsProps {
  profile: AdminProfile;
}

/**
 * BOX 103 — the four facts (spec §6.32). Phone and role are values, not fields: the number is masked
 * at the source and changed only by a Super Admin, and there is a single admin role today, so the
 * role reads "Administrator" with the note that permissions come from the Super Admin. That note is
 * a placeholder which becomes meaningful when RBAC arrives (§14.3).
 */
export function ProfileDetails({ profile }: ProfileDetailsProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup foot={t("profile.permissionsNote")}>
      <SettingsCard>
        <SettingsRow label={t("profile.email")} value={profile.email} />
        <SettingsRow
          label={t("profile.phone")}
          value={profile.maskedPhone}
          control={
            <Icon
              glyph={Lock}
              size="sm"
              className="shrink-0 text-text-3"
              label={t("profile.phoneLocked")}
            />
          }
        />
        <SettingsRow label={t("profile.role")} value={t("profile.roleValue")} />
        <SettingsRow label={t("profile.joined")} value={formatDate(profile.joinedIso)} />
      </SettingsCard>
    </SettingsGroup>
  );
}
