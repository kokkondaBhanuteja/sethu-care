// The single gate every mutation and every destructive affordance passes through (Admin spec §10.2).
//
// v1 ships one admin role with full access, so this returns true for any authenticated admin whose
// session carries no explicit permission scope. That is deliberate: the guard already exists and is
// already called everywhere, so adding roles later is a change to the session payload, not to the UI.
//
// Hiding a button is NOT the security model. The backend re-authorises every mutation; this exists
// so the console never offers an action it knows will be refused, and so the permission-denied
// state (§4.10) has one place to come from.

import type { SessionUser } from "@sethu/core";

import type { AdminAction } from "./actions";

/** What an action is being performed against, so future zone/ownership scoping has a place to land. */
export interface ActionResource {
  readonly type: string;
  readonly id: string;
  /** Service zone, the anticipated second RBAC dimension (spec §10.2). */
  readonly zone?: string;
}

export type PermissionDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: PermissionDenialReason };

export const PERMISSION_DENIAL_REASONS = {
  notAuthenticated: "not_authenticated",
  notAdmin: "not_admin",
  notPermitted: "not_permitted",
} as const;

export type PermissionDenialReason =
  (typeof PERMISSION_DENIAL_REASONS)[keyof typeof PERMISSION_DENIAL_REASONS];

const ALLOWED: PermissionDecision = { allowed: true };

/**
 * Decide whether `user` may perform `action` on `resource`.
 *
 * `resource` is accepted and ignored today; it is part of the signature so zone scoping becomes a
 * body change rather than a call-site migration across every screen.
 */
export function decide(
  user: SessionUser | null,
  action: AdminAction,
  _resource?: ActionResource,
): PermissionDecision {
  if (!user) {
    return { allowed: false, reason: PERMISSION_DENIAL_REASONS.notAuthenticated };
  }
  if (user.role !== "ADMIN") {
    return { allowed: false, reason: PERMISSION_DENIAL_REASONS.notAdmin };
  }
  // No scope on the session means the v1 single-role admin: full access.
  if (!user.permissions) return ALLOWED;

  return user.permissions.includes(action)
    ? ALLOWED
    : { allowed: false, reason: PERMISSION_DENIAL_REASONS.notPermitted };
}

/** Boolean convenience for rendering. Use `decide` when the denial reason has to be shown. */
export function can(
  user: SessionUser | null,
  action: AdminAction,
  resource?: ActionResource,
): boolean {
  return decide(user, action, resource).allowed;
}
