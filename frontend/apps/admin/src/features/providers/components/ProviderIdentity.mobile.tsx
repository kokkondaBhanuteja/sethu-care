import { Ban, MessageSquare, Phone, ShieldCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Pill } from "../../../components/ui/Pill";
import { formatDateShort } from "../../../lib/format";
import { PROVIDER_STATUSES, type ProviderProfile } from "../providers.types";
import { AVATAR_STATUS_FOR_PROVIDER } from "./ProviderStatusIndicator";

export interface ProviderIdentityProps {
  profile: ProviderProfile;
  /** Contact affordances disappear on an offboarded record — there is nobody left to call. */
  showContact: boolean;
}

/** M65–M68. Identity, with the rating line running full width so it never wraps behind the buttons. */
export function ProviderIdentity({ profile, showContact }: ProviderIdentityProps) {
  const { t } = useTranslation("adminProviders");
  const isOffboarded = profile.status === PROVIDER_STATUSES.offboarded;

  return (
    <div className="px-s4 py-s4">
      <div className="flex items-start gap-s3">
        {/* The name is printed beside it — a hearing avatar would announce it twice. */}
        <span aria-hidden>
          <Avatar
            name={profile.name}
            size="profile"
            brand={!isOffboarded}
            status={AVATAR_STATUS_FOR_PROVIDER[profile.status]}
          />
        </span>

        <div className="grow min-w-0">
          <div className="flex flex-wrap items-center gap-s2">
            <h2 className="text-title text-text-1">{profile.name}</h2>
            {isOffboarded ? (
              <Pill tone="neutral" icon={Ban}>
                {t("status.offboarded")}
              </Pill>
            ) : null}
          </div>
          <div className="mt-s1 flex flex-wrap items-center gap-s2">
            {profile.isVerified && !isOffboarded ? (
              <Pill tone="success" icon={ShieldCheck}>
                {t("profile.verified")}
              </Pill>
            ) : null}
            <span className="font-mono text-caption text-text-3">{profile.id}</span>
          </div>
        </div>

        {showContact ? (
          <div className="flex flex-none items-center gap-s1">
            <Button
              variant="outline"
              size="inline"
              aria-label={t("profile.callLabel", { name: profile.name })}
            >
              <Icon glyph={Phone} />
            </Button>
            <Button
              variant="outline"
              size="inline"
              aria-label={t("profile.messageLabel", { name: profile.name })}
            >
              <Icon glyph={MessageSquare} />
            </Button>
          </div>
        ) : null}
      </div>

      <p className="mt-s2 text-label text-text-2">
        {t("profile.identityMeta", {
          rating: profile.rating,
          jobs: profile.jobsTotal,
          joined: formatDateShort(profile.joinedAt),
        })}
      </p>
    </div>
  );
}
