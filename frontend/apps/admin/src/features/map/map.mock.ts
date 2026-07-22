import { mockRead } from "../../mocks/mockTransport";
import {
  KOMPALLY_PROVIDER_IDS,
  MAP_ATTENTION,
  MAP_CLUSTERS,
  MAP_JOBS,
  MAP_PROVIDERS,
  MAP_ZONES,
  ZONES,
} from "./map.fixtures";
import type { LiveMapSnapshot } from "./map.types";

/** The counts BOX 24 prints. Totals for the whole city, not a count of the markers shipped. */
const ACTIVE_JOB_COUNT = 42;
const ONLINE_PROVIDER_COUNT = 18;

/** BOX 25 takes the three Kompally providers off the map with the banner and 18 becomes 15. */
const ZERO_SUPPLY_ONLINE_COUNT = 15;

const KOMPALLY_IDS: ReadonlySet<string> = new Set(KOMPALLY_PROVIDER_IDS);

function snapshot(): LiveMapSnapshot {
  return {
    observedAt: new Date().toISOString(),
    activeJobCount: ACTIVE_JOB_COUNT,
    onlineProviderCount: ONLINE_PROVIDER_COUNT,
    zones: MAP_ZONES,
    providers: MAP_PROVIDERS,
    jobs: MAP_JOBS,
    clusters: MAP_CLUSTERS,
    attention: MAP_ATTENTION,
    zeroSupplyZoneIds: [],
  };
}

/**
 * VITE_MOCK_MODE=empty reaches the zero-providers-online state, not a blank screen: spec §6.7 makes
 * zero supply a warning banner over a still-working map, because it is a business emergency rather
 * than an absence of data. BOX 25 also strips Kompally's own markers — a banner saying nobody is
 * online above a map still showing free technicians there teaches the operator to distrust both.
 */
function zeroSupplySnapshot(): LiveMapSnapshot {
  return {
    ...snapshot(),
    onlineProviderCount: ZERO_SUPPLY_ONLINE_COUNT,
    providers: MAP_PROVIDERS.filter((candidate) => !KOMPALLY_IDS.has(candidate.id)),
    zeroSupplyZoneIds: [ZONES.kompally],
  };
}

export function fetchLiveMapSnapshotMock(signal?: AbortSignal): Promise<LiveMapSnapshot> {
  return mockRead(snapshot, {
    ...(signal ? { signal } : {}),
    emptyValue: zeroSupplySnapshot(),
  });
}
