import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Icon } from "../../components/ui/Icon";
import { ROUTES } from "../../routes/routes.constants";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import type { AdminProfile } from "./settings.types";

export interface MoreMenuIdentityProps {
  profile: AdminProfile;
}

/** The identity card at the top of the More menu — the whole row opens the profile (BOX 95). */
export function MoreMenuIdentity({ profile }: MoreMenuIdentityProps) {
  const { t } = useTranslation("adminSettings");

  return (
    <SettingsGroup>
      <SettingsCard>
        <Link
          to={ROUTES.profile}
          className="flex min-h-row-72 items-center gap-s3 px-s4 py-s2 text-left"
        >
          <Avatar name={profile.name} size="xl" brand />
          <span className="grow min-w-0">
            <span className="block text-card text-text-1">{profile.name}</span>
            <span className="block truncate text-label text-text-2">
              {t("more.profileSubtitle", { role: profile.role, email: profile.email })}
            </span>
          </span>
          <Icon glyph={ChevronRight} className="shrink-0 text-text-3" />
        </Link>
      </SettingsCard>
    </SettingsGroup>
  );
}
