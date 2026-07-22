import { Fragment } from "react";
import { useTranslation } from "@sethu/i18n";

import { Topbar } from "../../layouts/Topbar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { SkeletonList } from "../../components/ui/Skeleton";
import { formatDate } from "../../lib/format";
import { ProfileActivity } from "./ProfileActivity";
import { ProfilePreferences } from "./ProfilePreferences";
import { useAdminProfile } from "./useAdminProfile";
import { useSettingsCrumbs } from "./useSettingsCrumbs";
import type { AdminProfile } from "./settings.types";

/**
 * BOX 64 — the identity is horizontal rather than the mobile stack: the avatar and the name read as
 * one object and the four facts sit beside it, not below.
 */
export function AdminProfileDesktop() {
  const { t } = useTranslation("adminSettings");
  const { query, savePreferences } = useAdminProfile();
  const crumbs = useSettingsCrumbs(t("profile.title"));

  return (
    <>
      <Topbar crumbs={crumbs} />

      <main className="main">
        <div className="settings-col">
          <QueryBoundary
            query={query}
            skeleton={<SkeletonList rows={6} label={t("profile.loading")} />}
          >
            {(profile) => (
              <>
                <Card className="mb-s5 flex items-start gap-s6">
                  <Avatar name={profile.name} size="hero" brand />
                  <ProfileFacts profile={profile} />
                </Card>

                <ProfileActivity activity={profile.activity} wide />
                <ProfilePreferences
                  preferences={profile.preferences}
                  onChange={savePreferences}
                  wide
                />
              </>
            )}
          </QueryBoundary>
        </div>
      </main>
    </>
  );
}

function ProfileFacts({ profile }: { profile: AdminProfile }) {
  const { t } = useTranslation("adminSettings");

  const facts = [
    { id: "email", label: t("profile.email"), value: profile.email },
    { id: "phone", label: t("profile.phone"), value: profile.maskedPhone },
    { id: "role", label: t("profile.role"), value: t("profile.roleValue") },
    { id: "joined", label: t("profile.joined"), value: formatDate(profile.joinedIso) },
  ];

  return (
    <div className="grow">
      <p className="text-title text-text-1">{profile.name}</p>
      <p className="text-label text-text-2">
        {t("profile.identityLine", { role: profile.role, adminId: profile.adminId })}
      </p>

      <dl className="mt-s5 grid grid-cols-4 gap-x-s4 gap-y-s3">
        {facts.map((fact) => (
          <Fragment key={fact.id}>
            <dt className="text-label text-text-3">{fact.label}</dt>
            <dd className="col-span-3 text-label text-text-1">{fact.value}</dd>
          </Fragment>
        ))}
      </dl>

      <p className="mt-s5 text-caption text-text-3">{t("profile.permissionsNote")}</p>
    </div>
  );
}
