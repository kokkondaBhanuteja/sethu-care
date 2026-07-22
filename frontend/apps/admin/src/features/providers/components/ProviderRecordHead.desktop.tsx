import { FileText, MessageSquare, Phone, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { PageHeader } from "@sethu/ui-web";

import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Pill } from "../../../components/ui/Pill";
import { formatDateShort } from "../../../lib/format";
import type { ProviderProfile } from "../providers.types";
import type { ProviderProfileScreen } from "../hooks/useProviderProfile";
import { AVATAR_STATUS_FOR_PROVIDER, ProviderStatusIndicator } from "./ProviderStatusIndicator";

export interface ProviderRecordHeadProps {
  profile: ProviderProfile;
  screen: ProviderProfileScreen;
}

/**
 * The record head as a PageHeader: avatar-labelled identity, the status pill, and the
 * provider-level actions with Suspend carrying the destructive look. Suspend is REPLACED by
 * Restore rather than disabled when the provider is already suspended: there is nothing to
 * suspend twice, and restoring them is the only useful action left (BOX 39).
 */
export function ProviderRecordHead({ profile, screen }: ProviderRecordHeadProps) {
  const { t } = useTranslation("adminProviders");
  const isActionable = screen.canSuspend || screen.canForceOffline || screen.canRestore;

  return (
    <div className="border-b border-border bg-surface px-6 py-4">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {/* The name is printed beside it — a hearing avatar would announce it twice. */}
            <span aria-hidden>
              <Avatar
                name={profile.name}
                size="record"
                brand
                status={AVATAR_STATUS_FOR_PROVIDER[profile.status]}
              />
            </span>
            <span>{profile.name}</span>
            {profile.isVerified ? (
              <Pill tone="success" icon={ShieldCheck}>
                {t("profile.verified")}
              </Pill>
            ) : null}
            <ProviderStatusIndicator status={profile.status} />
            <span className="font-mono text-xs font-normal text-faint">{profile.id}</span>
          </span>
        }
        description={t("profile.identityMeta", {
          rating: profile.rating,
          jobs: profile.jobsTotal,
          joined: formatDateShort(profile.joinedAt),
        })}
        actions={isActionable ? <RecordHeadActions screen={screen} /> : undefined}
      />
    </div>
  );
}

function RecordHeadActions({ screen }: { screen: ProviderProfileScreen }) {
  const { t } = useTranslation("adminProviders");

  return (
    <>
      <Button variant="outline" size="inline" iconStart={Phone}>
        {t("profile.call")}
      </Button>
      <Button variant="outline" size="inline" iconStart={MessageSquare}>
        {t("profile.message")}
      </Button>
      <Button variant="outline" size="inline" iconStart={FileText}>
        {t("profile.addNote")}
      </Button>
      {screen.canForceOffline ? (
        <Button variant="outline" size="inline" onClick={screen.openSuspendFlow}>
          {t("profile.forceOffline")}
        </Button>
      ) : null}
      {screen.canSuspend ? (
        <Button variant="danger" size="inline" onClick={screen.openSuspendFlow}>
          {t("profile.suspend")}
        </Button>
      ) : null}
      {screen.canRestore ? (
        <Button
          variant="outlineSuccess"
          size="inline"
          iconStart={RotateCcw}
          isLoading={screen.isRestoring}
          onClick={screen.restore}
        >
          {t("profile.restore")}
        </Button>
      ) : null}
    </>
  );
}
