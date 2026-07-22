// Shapes for the settings family (spec §6.22, §6.30–§6.34). None of these endpoints exists on the
// backend yet, so the types are declared here rather than taken from @sethu/api-client; when the
// endpoints land they are replaced by the generated shapes and only settings.api.ts changes.

import type {
  APPEARANCE_MODES,
  CONFIGURABLE_CHANNELS,
  CRITICAL_CHANNELS,
  DESKTOP_SURFACES,
  DEVICE_KINDS,
  PAYOUT_STATUSES,
  SECURITY_EVENT_KINDS,
} from "./settings.constants";

export type ConfigurableChannel = (typeof CONFIGURABLE_CHANNELS)[number];
export type CriticalChannel = (typeof CRITICAL_CHANNELS)[number];
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];
export type DeviceKind = (typeof DEVICE_KINDS)[keyof typeof DEVICE_KINDS];
export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[keyof typeof SECURITY_EVENT_KINDS];
export type PayoutStatus = (typeof PAYOUT_STATUSES)[keyof typeof PAYOUT_STATUSES];
export type DesktopSurface = (typeof DESKTOP_SURFACES)[keyof typeof DESKTOP_SURFACES];

/** A wall-clock time of day, `HH:mm` in IST — quiet hours and the digest are not tied to a date. */
export type ClockTime = string;

export interface QuietHours {
  readonly enabled: boolean;
  readonly from: ClockTime;
  readonly to: ClockTime;
}

export interface NotificationSettings {
  /** Only the configurable tier is stored: the critical tier is not a preference (spec §6.30). */
  readonly channels: Readonly<Record<ConfigurableChannel, boolean>>;
  readonly digestTime: ClockTime;
  readonly quietHours: QuietHours;
  readonly criticalSound: string;
  readonly vibrate: boolean;
  /** Informational and operational alerts held back by quiet hours, waiting to be batched. */
  readonly queuedDuringQuietHours: number;
}

export interface TrustedDevice {
  readonly id: string;
  readonly name: string;
  readonly kind: DeviceKind;
  readonly lastUsedIso: string;
  readonly location: string;
  readonly isCurrent: boolean;
}

export interface SecurityEvent {
  readonly id: string;
  readonly kind: SecurityEventKind;
  /** Absent where the event came from a device the account does not recognise. */
  readonly device: string | null;
  readonly location: string | null;
  readonly atIso: string;
}

export interface SecuritySettings {
  readonly biometricUnlock: boolean;
  readonly devices: readonly TrustedDevice[];
  readonly deviceLimit: number;
  readonly activeSessions: number;
  readonly passwordChangedAtIso: string;
  readonly events: readonly SecurityEvent[];
}

export interface AdminActivity {
  readonly actions: number;
  readonly escalationsAcknowledged: number;
  readonly averageAcknowledgeMs: number;
  readonly bookingsRescued: number;
}

export interface AdminPreferences {
  readonly appearance: AppearanceMode;
  readonly haptics: boolean;
  readonly defaultLandingRoute: string;
}

export interface AdminProfile {
  readonly adminId: string;
  readonly name: string;
  readonly email: string;
  /** Masked at the source. The full number is never sent to this client (spec §5.6). */
  readonly maskedPhone: string;
  readonly role: string;
  readonly joinedIso: string;
  readonly activity: AdminActivity;
  readonly preferences: AdminPreferences;
}

export interface AppVersion {
  readonly app: string;
  readonly build: string;
  readonly environment: string;
  readonly bundle: string;
}

export interface PayoutRow {
  readonly providerId: string;
  readonly providerName: string;
  readonly jobs: number;
  readonly grossPaise: number;
  readonly commissionPaise: number;
  /** Negative where a refund or a penalty is deducted from this cycle. */
  readonly adjustmentsPaise: number;
  readonly netPaise: number;
  readonly status: PayoutStatus;
}

export interface PayoutCycle {
  readonly pendingPaise: number;
  readonly providersAwaiting: number;
  readonly zones: number;
  readonly cycleClosesIso: string;
  readonly nextRunIso: string;
  readonly nextRunTime: ClockTime;
  readonly lastRunPaise: number;
  readonly lastRunIso: string;
  readonly lastRunProviders: number;
  readonly rows: readonly PayoutRow[];
  readonly totals: Omit<PayoutRow, "providerId" | "providerName" | "status">;
}
