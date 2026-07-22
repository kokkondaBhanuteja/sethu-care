import { Ban, MoreVertical, RotateCcw } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { cx } from "../../lib/cx";
import { ActionBar } from "./components/ActionBar";
import { MobileScroll } from "./components/PageBody";
import { OffboardedBanner, SuspensionBanner } from "./components/ProviderBanners";
import { ProviderIdentity } from "./components/ProviderIdentity.mobile";
import { ProviderProfileSections } from "./components/ProviderProfileSections.mobile";
import { useProviderProfile } from "./hooks/useProviderProfile";

/**
 * M63–M68. The banner sits under the identity block because it belongs to this provider rather
 * than to the console: it must scroll away with him, not follow the operator to the next screen.
 * The offboarded strip is the exception — it explains why the body is dimmed, so it stays outside
 * the scroll region and at full opacity.
 */
export function ProviderProfileMobile() {
  const { t } = useTranslation("adminProviders");
  const screen = useProviderProfile();
  const profile = screen.query.data ?? null;
  const isOffboarded = Boolean(profile?.offboardedAt);

  return (
    <>
      <MobileAppBar
        title={t("profile.title")}
        showBack
        compact
        bordered
        actions={
          <Button variant="text" size="inline" aria-label={t("profile.moreActions")}>
            <Icon glyph={MoreVertical} size="lg" className="text-text-2" />
          </Button>
        }
      />

      {profile?.offboardedAt ? <OffboardedBanner offboardedAt={profile.offboardedAt} /> : null}

      <MobileScroll className={cx(isOffboarded && "opacity-60")}>
        <QueryBoundary
          query={screen.query}
          isEmpty={(loaded) => loaded === null}
          empty={<NotFoundState subject={t("profile.notFound")} />}
          skeleton={
            <SkeletonList rows={5} rowClassName="h-row-72" label={t("profile.loadingLabel")} />
          }
        >
          {(loaded) =>
            loaded === null ? null : (
              <>
                <ProviderIdentity profile={loaded} showContact={!isOffboarded} />
                {loaded.suspension ? <SuspensionBanner suspension={loaded.suspension} /> : null}
                <ProviderProfileSections profile={loaded} screen={screen} />
              </>
            )
          }
        </QueryBoundary>
        <div aria-hidden className="h-s4" />
      </MobileScroll>

      {profile && !isOffboarded ? (
        <ActionBar>
          {screen.canRestore ? (
            <Button
              variant="outlineSuccess"
              size="primary"
              block
              iconStart={RotateCcw}
              isLoading={screen.isRestoring}
              onClick={screen.restore}
            >
              {t("profile.restore")}
            </Button>
          ) : (
            <div className="flex gap-s2">
              {screen.canForceOffline ? (
                <Button variant="outline" size="primary" block onClick={screen.openSuspendFlow}>
                  {t("profile.forceOffline")}
                </Button>
              ) : null}
              {screen.canSuspend ? (
                <Button
                  variant="outlineDanger"
                  size="primary"
                  block
                  iconStart={Ban}
                  onClick={screen.openSuspendFlow}
                >
                  {t("profile.suspend")}
                </Button>
              ) : null}
            </div>
          )}
        </ActionBar>
      ) : null}
    </>
  );
}
