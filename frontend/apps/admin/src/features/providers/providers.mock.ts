// Roster reads (BOX 20 / 21, M34–M37) over the fixtures in `providerFixtures.ts` — the artifact's
// data verbatim, so the implemented screen and the approved design can be diffed.
//
// `VITE_MOCK_MODE=empty` collapses this to the empty roster; `=error` exercises retry; `=slow`
// exercises the skeleton. See mocks/CLAUDE.md.

import { mockRead } from "../../mocks/mockTransport";
import { minutesAgo, ROSTER_ROWS } from "./providerFixtures";
import { PROVIDER_STATUSES, ROSTER_SEGMENTS } from "./providers.types";
import type { ProviderRoster, ProviderRosterRow, RosterSegment } from "./providers.types";

/**
 * `healthy` is BOX 21 / M35, where the supply strip is absent rather than green; `stale` is M36,
 * where every live status is old enough to be a wrong answer rather than merely old.
 */
export const ROSTER_VARIANTS = { normal: "normal", healthy: "healthy", stale: "stale" } as const;
export type RosterVariant = (typeof ROSTER_VARIANTS)[keyof typeof ROSTER_VARIANTS];

const STALE_STATUS_AGE_MINUTES = 20;

const EMPTY_ROSTER: ProviderRoster = {
  rows: [],
  counts: { total: 0, online: 0, onJob: 0, suspended: 0 },
  shortfall: null,
  pendingApplications: 0,
  oldestApplicationDays: 0,
  statusesAsOf: new Date().toISOString(),
};

function matchesSegment(row: ProviderRosterRow, segment: RosterSegment): boolean {
  if (segment === ROSTER_SEGMENTS.all) return true;
  if (segment === ROSTER_SEGMENTS.onJob) return row.status === PROVIDER_STATUSES.onJob;
  return row.status === PROVIDER_STATUSES.free;
}

function matchesSearch(row: ProviderRosterRow, search: string): boolean {
  if (search.length === 0) return true;
  const needle = search.toLowerCase();
  return (
    row.name.toLowerCase().includes(needle) ||
    row.id.toLowerCase().includes(needle) ||
    row.zone.toLowerCase().includes(needle)
  );
}

export function fetchProviderRosterMock(
  segment: RosterSegment,
  search: string,
  variant: RosterVariant,
  signal?: AbortSignal,
): Promise<ProviderRoster> {
  return mockRead<ProviderRoster>(
    () => ({
      rows: ROSTER_ROWS.filter(
        (row) => matchesSegment(row, segment) && matchesSearch(row, search),
      ),
      counts: {
        total: 84,
        online: variant === ROSTER_VARIANTS.healthy ? 22 : 18,
        onJob: 11,
        suspended: 1,
      },
      // Kompally runs two of the five it needs — the shortfall the whole screen is arranged around.
      shortfall:
        variant === ROSTER_VARIANTS.healthy
          ? null
          : { zone: "Kompally", onlineCount: 2, threshold: 5 },
      pendingApplications: 3,
      oldestApplicationDays: 4,
      statusesAsOf:
        variant === ROSTER_VARIANTS.stale
          ? minutesAgo(STALE_STATUS_AGE_MINUTES)
          : new Date().toISOString(),
    }),
    { ...(signal ? { signal } : {}), emptyValue: EMPTY_ROSTER },
  );
}
