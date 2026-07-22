/** Counters the shells badge with. Cross-feature, so they live at the app layer (Part 3.2). */
export interface ShellCounters {
  /** Unacknowledged CRITICAL alerts only — the badge must mean "a human must act" (spec §3.1). */
  readonly criticalAlerts: number;
  readonly needsAttention: number;
  readonly pendingApplications: number;
  readonly openTickets: number;
}

/** The signed-in admin, as the shells render them in the sidebar footer and the More menu. */
export interface AdminIdentity {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roleLabel: string;
}
