import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Avatar } from "../../components/ui/Avatar";
import { SkeletonList } from "../../components/ui/Skeleton";
import { ProfileActivity } from "./ProfileActivity";
import { ProfileDetails } from "./ProfileDetails";
import { ProfilePreferences } from "./ProfilePreferences";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { useAdminProfile } from "./useAdminProfile";

/** BOX 103 — identity, the four facts, the gentle activity read-out, and the preferences. */
export function AdminProfileMobile() {
  const { t } = useTranslation("adminSettings");
  const { query, savePreferences } = useAdminProfile();

  return (
    <>
      <MobileAppBar title={t("profile.title")} showBack compact onSurface />

      <div className="screen__scroll bg-surface pt-s2">
        <QueryBoundary
          query={query}
          skeleton={
            <div className="px-s4">
              <SkeletonList rows={6} label={t("profile.loading")} />
            </div>
          }
        >
          {(profile) => (
            <>
              <SettingsGroup>
                <SettingsCard className="flex flex-col items-center gap-s3 p-s6">
                  <Avatar name={profile.name} size="hero" brand />
                  <span className="flex flex-col items-center">
                    <span className="text-title text-text-1">{profile.name}</span>
                    <span className="text-label text-text-2">{profile.role}</span>
                    <span className="text-caption text-text-3">{profile.adminId}</span>
                  </span>
                </SettingsCard>
              </SettingsGroup>

              <ProfileDetails profile={profile} />
              <ProfileActivity activity={profile.activity} />
              <ProfilePreferences preferences={profile.preferences} onChange={savePreferences} />
            </>
          )}
        </QueryBoundary>
      </div>
    </>
  );
}
