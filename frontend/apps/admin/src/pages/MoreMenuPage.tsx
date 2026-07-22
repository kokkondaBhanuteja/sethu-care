import { Navigate } from "react-router";

import { MoreMenuMobile } from "../features/settings/MoreMenu.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";
import { ROUTES } from "../routes/routes.constants";

/**
 * BOX 95. Mobile only: desktop has no More menu, because the always-visible sidebar is its
 * equivalent (BOX 59). A deep link to /more on a desktop lands on the profile, which is the one
 * destination in the menu the sidebar does not name.
 */
export default function MoreMenuPage() {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <Navigate to={ROUTES.profile} replace />;
  return <MoreMenuMobile />;
}
