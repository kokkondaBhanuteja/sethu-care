import type { MapLayer } from "./map.constants";
import type { AttentionReason, JobMapState, ProviderMapStatus } from "./map.types";

// Vocabulary → translation key, as literal types. Building the key with a template string would
// hand `t()` a `string` and lose the compile-time guarantee that a wrong key is an error
// (ENGINEERING-STANDARDS Part 8).

export const PROVIDER_STATUS_KEYS = {
  online: "status.online",
  busy: "status.busy",
  offline: "status.offline",
} as const satisfies Record<ProviderMapStatus, string>;

export const JOB_STATE_KEYS = {
  enRoute: "jobState.enRoute",
  onSite: "jobState.onSite",
  delayed: "jobState.delayed",
  escalated: "jobState.escalated",
} as const satisfies Record<JobMapState, string>;

export const ATTENTION_REASON_KEYS = {
  escalated: "attention.escalated",
  noProvider: "attention.noProvider",
} as const satisfies Record<AttentionReason, string>;

export const LAYER_KEYS = {
  activeJobs: "layers.activeJobs",
  providersOnline: "layers.providersOnline",
  escalationsOnly: "layers.escalationsOnly",
  demandHeatmap: "layers.demandHeatmap",
  serviceAreas: "layers.serviceAreas",
} as const satisfies Record<MapLayer, string>;
