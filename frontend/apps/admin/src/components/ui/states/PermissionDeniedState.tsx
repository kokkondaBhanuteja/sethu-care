import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../EmptyState";

export interface PermissionDeniedStateProps {
  /** What was refused, so the operator knows what to ask for. */
  action?: string;
  grow?: boolean;
}

/**
 * Specified in the design and implemented now although v1 ships a single full-access admin role
 * (spec §10.2). It exists so adding RBAC later is a session-payload change, not a UI project — and
 * so `can()` always has somewhere to send a refusal.
 */
export function PermissionDeniedState({ action, grow = true }: PermissionDeniedStateProps) {
  const { t } = useTranslation("adminShell");

  return (
    <EmptyState
      icon={Lock}
      title={t("state.permissionDeniedTitle")}
      body={
        action ? `${action} — ${t("state.permissionDeniedBody")}` : t("state.permissionDeniedBody")
      }
      grow={grow}
    />
  );
}
