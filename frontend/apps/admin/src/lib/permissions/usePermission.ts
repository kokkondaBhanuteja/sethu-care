import { useSession } from "@sethu/core";

import type { AdminAction } from "./actions";
import { policyFor, type ActionPolicy } from "./actions";
import { can, decide, type ActionResource, type PermissionDecision } from "./can";

/** React binding for the permission gate. Components call this rather than reading the session. */
export function usePermission(action: AdminAction, resource?: ActionResource): PermissionDecision {
  const user = useSession((state) => state.user);
  return decide(user, action, resource);
}

export function useCan(action: AdminAction, resource?: ActionResource): boolean {
  const user = useSession((state) => state.user);
  return can(user, action, resource);
}

/** The policy plus the current decision — what an action button needs in one call. */
export function useActionPolicy(
  action: AdminAction,
  resource?: ActionResource,
): { policy: ActionPolicy; decision: PermissionDecision } {
  const decision = usePermission(action, resource);
  return { policy: policyFor(action), decision };
}
