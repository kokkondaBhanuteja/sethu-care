import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { MobileAppBar } from "../../layouts/MobileAppBar";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Skeleton } from "../../components/ui/Skeleton";
import { useShellCounters } from "../../queries/useShellCounters";
import { MoreMenuIdentity } from "./MoreMenuIdentity";
import { MoreMenuSection } from "./MoreMenuSection";
import { SettingsCard, SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SignOutConfirm } from "./SignOutConfirm";
import {
  MORE_ACCOUNT_ITEMS,
  MORE_DESKTOP_ITEMS,
  MORE_OPERATIONS_ITEMS,
} from "./settings.constants";
import { useAdminProfile } from "./useAdminProfile";
import { useAppVersion } from "./useAppVersion";

/**
 * BOX 95 — the root of the settings family, and the screen that establishes it: a recessed grey
 * canvas with white grouped cards, which is how this product signals "you have left the operational
 * surface and entered configuration" (spec §6.22).
 *
 * Desktop has no More menu; the always-visible sidebar is its equivalent.
 */
export function MoreMenuMobile() {
  const { t } = useTranslation("adminSettings");
  const { query } = useAdminProfile();
  const versionQuery = useAppVersion().query;
  const counters = useShellCounters();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

  return (
    <>
      <MobileAppBar title={t("more.title")} onSurface />

      <div className="screen__scroll bg-surface pt-s2">
        <QueryBoundary
          query={query}
          skeleton={
            <SettingsGroup>
              <SettingsCard>
                <Skeleton className="m-s4 h-row-48" />
              </SettingsCard>
            </SettingsGroup>
          }
        >
          {(profile) => <MoreMenuIdentity profile={profile} />}
        </QueryBoundary>

        <MoreMenuSection
          title={t("more.groupOperations")}
          description={t("more.groupOperationsDescription")}
          items={MORE_OPERATIONS_ITEMS}
          counters={counters}
        />

        <MoreMenuSection
          title={t("more.groupDesktop")}
          items={MORE_DESKTOP_ITEMS}
          foot={t("more.desktopFoot")}
          muted
        />

        <MoreMenuSection
          title={t("more.groupAccount")}
          description={t("more.groupAccountDescription")}
          items={MORE_ACCOUNT_ITEMS}
        />

        <SettingsGroup>
          <SettingsCard>
            <SettingsRow
              label={t("more.signOut")}
              tone="danger"
              centered
              onClick={() => setIsSignOutOpen(true)}
            />
          </SettingsCard>
        </SettingsGroup>

        <p className="px-s4 pb-s5 text-center text-caption text-text-3">
          {versionQuery.data
            ? t("more.version", {
                app: versionQuery.data.app,
                build: versionQuery.data.build,
                environment: versionQuery.data.environment,
              })
            : null}
        </p>
      </div>

      <SignOutConfirm isOpen={isSignOutOpen} onDismiss={() => setIsSignOutOpen(false)} />
    </>
  );
}
