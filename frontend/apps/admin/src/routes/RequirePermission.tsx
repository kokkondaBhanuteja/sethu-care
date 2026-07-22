import { Outlet } from "react-router";

import { PermissionDeniedState } from "../components/ui/states/PermissionDeniedState";
import { usePermission } from "../lib/permissions/usePermission";
import type { AdminAction } from "../lib/permissions/actions";

export interface RequirePermissionProps {
  action: AdminAction;
  /** Human-readable name of what was refused, so the operator knows what access to ask for. */
  description?: string;
}

/**
 * Page-level half of the permission model. The action-level half runs inside each mutation, because
 * hiding a route is not authorisation — the backend re-authorises every call, and this exists so
 * the console never routes an operator into a screen whose actions will all be refused.
 */
export function RequirePermission({ action, description }: RequirePermissionProps) {
  const decision = usePermission(action);

  if (!decision.allowed) {
    return <PermissionDeniedState {...(description ? { action: description } : {})} />;
  }

  return <Outlet />;
}
