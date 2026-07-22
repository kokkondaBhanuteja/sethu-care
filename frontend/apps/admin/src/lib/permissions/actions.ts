// The action registry mandated by Admin spec §10.2. Every mutation the console can perform is
// declared here exactly once, with the risk classification, step-up requirement, reason-code
// requirement and undo window from the §10.3 risk register (as amended by
// docs/Booking-Workflow-Decisions.md, which deletes reschedule).
//
// Screens read the registry; they never restate a policy inline. When RBAC lands (§14.3), roles
// map onto these ids and nothing in the UI changes.

export const RISK_LEVELS = {
  none: "none",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

export interface ActionPolicy {
  /** Stable identifier — also the permission string the session payload will carry. */
  readonly id: AdminAction;
  readonly risk: RiskLevel;
  /** Fresh biometric/passcode verification required, valid for 60s (spec §5.5). */
  readonly requiresStepUp: boolean;
  /** A reason code (and often a note) must accompany the mutation. */
  readonly requiresReason: boolean;
  /** Undo window in ms, or null where the action has outside-world effects that cannot be reversed. */
  readonly undoWindowMs: number | null;
  readonly audited: boolean;
}

export const ADMIN_ACTIONS = {
  viewRecord: "record.view",
  search: "record.search",
  acknowledgeAlert: "alert.acknowledge",
  addNote: "note.add",
  contactParty: "party.contact",
  assignProvider: "booking.assign",
  redispatch: "booking.redispatch",
  cancelBooking: "booking.cancel",
  manualComplete: "booking.manual_complete",
  refund: "payment.refund",
  goodwillCredit: "payment.goodwill",
  forceProviderOffline: "provider.force_offline",
  suspendProvider: "provider.suspend",
  blockProvider: "provider.block",
  approveApplication: "application.approve",
  rejectApplication: "application.reject",
  requestDocuments: "application.request_documents",
  blockCustomer: "customer.block",
  revokeDevice: "device.revoke",
} as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

const SECONDS = 1000;

export const ACTION_POLICIES: Readonly<Record<AdminAction, ActionPolicy>> = {
  [ADMIN_ACTIONS.viewRecord]: policy(ADMIN_ACTIONS.viewRecord, RISK_LEVELS.none, {}),
  [ADMIN_ACTIONS.search]: policy(ADMIN_ACTIONS.search, RISK_LEVELS.none, { audited: false }),
  [ADMIN_ACTIONS.acknowledgeAlert]: policy(ADMIN_ACTIONS.acknowledgeAlert, RISK_LEVELS.low, {}),
  [ADMIN_ACTIONS.addNote]: policy(ADMIN_ACTIONS.addNote, RISK_LEVELS.low, {}),
  [ADMIN_ACTIONS.contactParty]: policy(ADMIN_ACTIONS.contactParty, RISK_LEVELS.low, {}),

  [ADMIN_ACTIONS.assignProvider]: policy(ADMIN_ACTIONS.assignProvider, RISK_LEVELS.medium, {
    undoWindowMs: 30 * SECONDS,
  }),
  [ADMIN_ACTIONS.redispatch]: policy(ADMIN_ACTIONS.redispatch, RISK_LEVELS.medium, {}),
  [ADMIN_ACTIONS.forceProviderOffline]: policy(
    ADMIN_ACTIONS.forceProviderOffline,
    RISK_LEVELS.medium,
    {
      requiresReason: true,
      undoWindowMs: 30 * SECONDS,
    },
  ),
  [ADMIN_ACTIONS.approveApplication]: policy(ADMIN_ACTIONS.approveApplication, RISK_LEVELS.medium, {
    undoWindowMs: 30 * SECONDS,
  }),
  [ADMIN_ACTIONS.requestDocuments]: policy(ADMIN_ACTIONS.requestDocuments, RISK_LEVELS.low, {}),

  // High and critical actions: step-up + reason, per §5.5. Refund, goodwill and manual completion
  // have no undo because each has an immediate outside-world effect (gateway call, customer
  // notification, payout eligibility) — they are corrected by a compensating, itself-audited action.
  [ADMIN_ACTIONS.goodwillCredit]: policy(ADMIN_ACTIONS.goodwillCredit, RISK_LEVELS.high, {
    requiresStepUp: true,
    requiresReason: true,
  }),
  [ADMIN_ACTIONS.cancelBooking]: policy(ADMIN_ACTIONS.cancelBooking, RISK_LEVELS.high, {
    requiresStepUp: true,
    requiresReason: true,
    undoWindowMs: 10 * SECONDS,
  }),
  [ADMIN_ACTIONS.refund]: policy(ADMIN_ACTIONS.refund, RISK_LEVELS.high, {
    requiresStepUp: true,
    requiresReason: true,
  }),
  [ADMIN_ACTIONS.blockCustomer]: policy(ADMIN_ACTIONS.blockCustomer, RISK_LEVELS.high, {
    requiresStepUp: true,
    requiresReason: true,
    undoWindowMs: 10 * SECONDS,
  }),
  [ADMIN_ACTIONS.suspendProvider]: policy(ADMIN_ACTIONS.suspendProvider, RISK_LEVELS.high, {
    requiresStepUp: true,
    requiresReason: true,
    undoWindowMs: 10 * SECONDS,
  }),
  [ADMIN_ACTIONS.revokeDevice]: policy(ADMIN_ACTIONS.revokeDevice, RISK_LEVELS.high, {
    requiresStepUp: true,
  }),
  [ADMIN_ACTIONS.blockProvider]: policy(ADMIN_ACTIONS.blockProvider, RISK_LEVELS.critical, {
    requiresStepUp: true,
    requiresReason: true,
    undoWindowMs: 10 * SECONDS,
  }),
  [ADMIN_ACTIONS.rejectApplication]: policy(ADMIN_ACTIONS.rejectApplication, RISK_LEVELS.critical, {
    requiresStepUp: true,
    requiresReason: true,
  }),
  [ADMIN_ACTIONS.manualComplete]: policy(ADMIN_ACTIONS.manualComplete, RISK_LEVELS.critical, {
    requiresStepUp: true,
    requiresReason: true,
  }),
};

function policy(
  id: AdminAction,
  risk: RiskLevel,
  overrides: Partial<Omit<ActionPolicy, "id" | "risk">>,
): ActionPolicy {
  return {
    id,
    risk,
    requiresStepUp: overrides.requiresStepUp ?? false,
    requiresReason: overrides.requiresReason ?? false,
    undoWindowMs: overrides.undoWindowMs ?? null,
    audited: overrides.audited ?? true,
  };
}

export function policyFor(action: AdminAction): ActionPolicy {
  return ACTION_POLICIES[action];
}
