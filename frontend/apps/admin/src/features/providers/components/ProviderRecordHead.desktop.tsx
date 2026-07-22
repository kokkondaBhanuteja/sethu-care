import { FileText, MessageSquare, Phone, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Pill } from "../../../components/ui/Pill";
import { formatDateShort } from "../../../lib/format";
import type { ProviderProfile } from "../providers.types";
import type { ProviderProfileScreen } from "../hooks/useProviderProfile";
import { AVATAR_STATUS_FOR_PROVIDER } from "./ProviderStatusIndicator";

export interface ProviderRecordHeadProps {
  profile: ProviderProfile;
  screen: ProviderProfileScreen;
}

/**
 * Identity plus the provider-level actions. Suspend is REPLACED by Restore rather than disabled
 * when the provider is already suspended: there is nothing to suspend twice, and restoring them is
 * the only useful action left (BOX 39).
 */
export function ProviderRecordHead({ profile, screen }: ProviderRecordHeadProps) {
  const { t } = useTranslation("adminProviders");
  const isActionable = screen.canSuspend || screen.canForceOffline || screen.canRestore;

  return (
    <div className="flex flex-none items-center gap-s5 border-b border-border-subtle bg-canvas p-s6">
      <Avatar
        name={profile.name}
        size="hero"
        brand
        status={AVATAR_STATUS_FOR_PROVIDER[profile.status]}
      />

      <div className="grow">
        <div className="flex items-center gap-s2">
          <h2 className="text-title text-text-1">{profile.name}</h2>
          {profile.isVerified ? (
            <Pill tone="success" icon={ShieldCheck}>
              {t("profile.verified")}
            </Pill>
          ) : null}
          <span className="font-mono text-caption text-text-3">{profile.id}</span>
        </div>
        <p className="mt-s1 text-label text-text-2">
          {t("profile.identityMeta", {
            rating: profile.rating,
            jobs: profile.jobsTotal,
            joined: formatDateShort(profile.joinedAt),
          })}
        </p>
      </div>

      {isActionable ? (
        <div className="flex flex-none items-center gap-s2">
          <Button variant="outline" iconStart={Phone}>
            {t("profile.call")}
          </Button>
          <Button variant="outline" iconStart={MessageSquare}>
            {t("profile.message")}
          </Button>
          <Button variant="outline" iconStart={FileText}>
            {t("profile.addNote")}
          </Button>
          {screen.canForceOffline ? (
            <Button variant="outline" onClick={screen.openSuspendFlow}>
              {t("profile.forceOffline")}
            </Button>
          ) : null}
          {screen.canSuspend ? (
            <Button variant="outlineDanger" onClick={screen.openSuspendFlow}>
              {t("profile.suspend")}
            </Button>
          ) : null}
          {screen.canRestore ? (
            <Button
              variant="outlineSuccess"
              iconStart={RotateCcw}
              isLoading={screen.isRestoring}
              onClick={screen.restore}
            >
              {t("profile.restore")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
