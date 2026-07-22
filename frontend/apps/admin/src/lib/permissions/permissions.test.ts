import { describe, expect, it } from "vitest";
import type { SessionUser } from "@sethu/core";

import {
  ACTION_POLICIES,
  ADMIN_ACTIONS,
  RISK_LEVELS,
  policyFor,
  type AdminAction,
} from "./actions";
import { PERMISSION_DENIAL_REASONS, can, decide } from "./can";

// The action registry encodes Admin spec §10.3's risk register. These tests are the guard on it:
// quietly dropping a step-up requirement or granting an undo to an irreversible action would be a
// safety regression that nothing else in the codebase would notice.

const admin: SessionUser = { role: "ADMIN", name: "Ravi Kumar" };
const scopedAdmin: SessionUser = {
  role: "ADMIN",
  name: "Ravi",
  permissions: [ADMIN_ACTIONS.viewRecord],
};
const technician: SessionUser = { role: "TECHNICIAN", name: "Suresh Mehta" };

describe("the risk register", () => {
  it("declares every action exactly once, keyed by its own id", () => {
    for (const [key, policy] of Object.entries(ACTION_POLICIES)) {
      expect(policy.id).toBe(key);
    }
    expect(Object.keys(ACTION_POLICIES)).toHaveLength(Object.values(ADMIN_ACTIONS).length);
  });

  it.each([
    ADMIN_ACTIONS.cancelBooking,
    ADMIN_ACTIONS.manualComplete,
    ADMIN_ACTIONS.refund,
    ADMIN_ACTIONS.goodwillCredit,
    ADMIN_ACTIONS.suspendProvider,
    ADMIN_ACTIONS.blockProvider,
    ADMIN_ACTIONS.blockCustomer,
    ADMIN_ACTIONS.rejectApplication,
    ADMIN_ACTIONS.revokeDevice,
  ])("requires fresh step-up for %s", (action) => {
    expect(policyFor(action).requiresStepUp).toBe(true);
  });

  it.each([
    ADMIN_ACTIONS.assignProvider,
    ADMIN_ACTIONS.redispatch,
    ADMIN_ACTIONS.acknowledgeAlert,
    ADMIN_ACTIONS.approveApplication,
    ADMIN_ACTIONS.contactParty,
  ])("does not gate %s behind step-up, because friction on a rescue costs minutes", (action) => {
    expect(policyFor(action).requiresStepUp).toBe(false);
  });

  it.each([
    ADMIN_ACTIONS.refund,
    ADMIN_ACTIONS.goodwillCredit,
    ADMIN_ACTIONS.manualComplete,
    ADMIN_ACTIONS.rejectApplication,
    ADMIN_ACTIONS.revokeDevice,
  ])("gives %s no undo window — it has an outside-world effect", (action) => {
    // A refund calls the gateway; a manual completion notifies the customer and releases payout
    // eligibility. Offering Undo on either would be a lie (spec §5.5).
    expect(policyFor(action).undoWindowMs).toBeNull();
  });

  it("gives the reversible destructive actions 10 seconds and the routine ones 30", () => {
    expect(policyFor(ADMIN_ACTIONS.cancelBooking).undoWindowMs).toBe(10_000);
    expect(policyFor(ADMIN_ACTIONS.suspendProvider).undoWindowMs).toBe(10_000);
    expect(policyFor(ADMIN_ACTIONS.blockProvider).undoWindowMs).toBe(10_000);
    expect(policyFor(ADMIN_ACTIONS.assignProvider).undoWindowMs).toBe(30_000);
    expect(policyFor(ADMIN_ACTIONS.approveApplication).undoWindowMs).toBe(30_000);
  });

  it("demands a reason code for every high and critical action", () => {
    const highRisk = Object.values(ACTION_POLICIES).filter(
      (policy) => policy.risk === RISK_LEVELS.high || policy.risk === RISK_LEVELS.critical,
    );
    // Revoking a device is the one exception the register makes: the device list IS the reason.
    const withoutReason = highRisk
      .filter((policy) => !policy.requiresReason)
      .map((policy) => policy.id);
    expect(withoutReason).toEqual([ADMIN_ACTIONS.revokeDevice]);
  });

  it("audits everything except search", () => {
    const unaudited = Object.values(ACTION_POLICIES)
      .filter((policy) => !policy.audited)
      .map((policy) => policy.id);
    expect(unaudited).toEqual([ADMIN_ACTIONS.search]);
  });

  it("never marks an action step-up-required without also making it high risk or worse", () => {
    for (const policy of Object.values(ACTION_POLICIES)) {
      if (!policy.requiresStepUp) continue;
      expect([RISK_LEVELS.high, RISK_LEVELS.critical]).toContain(policy.risk);
    }
  });
});

describe("can()", () => {
  const everyAction = Object.values(ADMIN_ACTIONS) as AdminAction[];

  it("grants an unscoped admin everything — the v1 single-role behaviour", () => {
    for (const action of everyAction) {
      expect(can(admin, action)).toBe(true);
    }
  });

  it("refuses a signed-out user", () => {
    expect(decide(null, ADMIN_ACTIONS.cancelBooking)).toEqual({
      allowed: false,
      reason: PERMISSION_DENIAL_REASONS.notAuthenticated,
    });
  });

  it("refuses a non-admin even with a valid session", () => {
    expect(decide(technician, ADMIN_ACTIONS.viewRecord)).toEqual({
      allowed: false,
      reason: PERMISSION_DENIAL_REASONS.notAdmin,
    });
  });

  it("honours an explicit permission list once the server sends one", () => {
    // This is the whole point of shipping the guard before RBAC exists: adding roles later is a
    // change to the session payload, not to the UI.
    expect(can(scopedAdmin, ADMIN_ACTIONS.viewRecord)).toBe(true);
    expect(decide(scopedAdmin, ADMIN_ACTIONS.refund)).toEqual({
      allowed: false,
      reason: PERMISSION_DENIAL_REASONS.notPermitted,
    });
  });

  it("treats an empty permission list as 'nothing', not as 'unscoped'", () => {
    const lockedOut: SessionUser = { role: "ADMIN", name: "Ravi", permissions: [] };
    expect(can(lockedOut, ADMIN_ACTIONS.viewRecord)).toBe(false);
  });
});
