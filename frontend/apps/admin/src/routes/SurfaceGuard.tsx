import { Outlet, useNavigate } from "react-router";
import { Monitor } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useIsDesktop } from "../hooks/useBreakpoint";

export interface SurfaceGuardProps {
  /** adminShell:nav key naming what lives here, so the notice says it rather than "this page". */
  destinationLabelKey: string;
  /** A read-only summary rendered above the notice, where the route can offer one. */
  summary?: React.ReactNode;
}

/**
 * The "Best on desktop" screen (spec §6.34).
 *
 * `desktopOnly` is a product decision — payouts, settlement cycles and ledger work are batch
 * processes, not phone work (spec §1.5). A deep link to one from a phone must never produce a blank
 * screen, a 404 or a broken layout: it shows what it can, explains why, and offers a way forward.
 * That distinction is what separates a scope decision from a bug.
 */
export function SurfaceGuard({ destinationLabelKey, summary }: SurfaceGuardProps) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { t } = useTranslation("adminShell");

  if (isDesktop) return <Outlet />;

  return (
    <div className="screen__scroll gut">
      {summary}
      <EmptyState
        icon={Monitor}
        title={t("state.desktopOnlyTitle")}
        body={`${t(destinationLabelKey)} — ${t("state.desktopOnlyBody")}`}
        grow
        actions={
          <Button variant="outline" size="secondary" block onClick={() => void navigate(-1)}>
            {t("state.desktopOnlyBack")}
          </Button>
        }
      />
    </div>
  );
}
