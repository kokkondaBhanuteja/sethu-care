// Client-side refinements over the loaded roster page (skill / zone / status).
//
// The segment and the search term shape the query key and travel to the server; these three
// narrow the returned rows only, so they live here as pure functions that the roster hook and
// its unit test share. Skill and zone vocabularies are backend data (plain strings), which is
// why the option lists are derived from the rows rather than declared.

import { PROVIDER_STATUSES, type ProviderRosterRow, type ProviderStatus } from "./providers.types";

/** The "no refinement" sentinel every filter control starts on. */
export const ROSTER_FILTER_ALL = "all" as const;

export type RosterStatusFilter = ProviderStatus | typeof ROSTER_FILTER_ALL;

export interface RosterRefinements {
  readonly skill: string;
  readonly zone: string;
  readonly status: RosterStatusFilter;
}

export const EMPTY_ROSTER_REFINEMENTS: RosterRefinements = {
  skill: ROSTER_FILTER_ALL,
  zone: ROSTER_FILTER_ALL,
  status: ROSTER_FILTER_ALL,
};

/** The status filter offers every dispatchability state, in the roster's severity order. */
export const ROSTER_STATUS_FILTER_ORDER: readonly ProviderStatus[] = [
  PROVIDER_STATUSES.free,
  PROVIDER_STATUSES.onJob,
  PROVIDER_STATUSES.offline,
  PROVIDER_STATUSES.suspended,
  PROVIDER_STATUSES.offboarded,
];

/** Narrows the raw string a select control emits back into the status-filter vocabulary. */
export function toRosterStatusFilter(value: string): RosterStatusFilter {
  const match = ROSTER_STATUS_FILTER_ORDER.find((status) => status === value);
  return match ?? ROSTER_FILTER_ALL;
}

export function isRosterRefined(refinements: RosterRefinements): boolean {
  return (
    refinements.skill !== ROSTER_FILTER_ALL ||
    refinements.zone !== ROSTER_FILTER_ALL ||
    refinements.status !== ROSTER_FILTER_ALL
  );
}

export function refineRosterRows(
  rows: readonly ProviderRosterRow[],
  refinements: RosterRefinements,
): readonly ProviderRosterRow[] {
  return rows.filter((row) => {
    if (refinements.skill !== ROSTER_FILTER_ALL && !row.skills.includes(refinements.skill)) {
      return false;
    }
    if (refinements.zone !== ROSTER_FILTER_ALL && row.zone !== refinements.zone) {
      return false;
    }
    if (refinements.status !== ROSTER_FILTER_ALL && row.status !== refinements.status) {
      return false;
    }
    return true;
  });
}

export interface RosterFilterOptions {
  readonly skills: readonly string[];
  readonly zones: readonly string[];
}

/**
 * Distinct skills and zones present in the loaded page, sorted for a stable dropdown. Derived
 * from the unrefined rows so choosing one filter never empties the other filter's options.
 */
export function rosterFilterOptions(rows: readonly ProviderRosterRow[]): RosterFilterOptions {
  const skills = new Set<string>();
  const zones = new Set<string>();
  for (const row of rows) {
    for (const skill of row.skills) skills.add(skill);
    zones.add(row.zone);
  }
  return {
    skills: [...skills].sort((first, second) => first.localeCompare(second)),
    zones: [...zones].sort((first, second) => first.localeCompare(second)),
  };
}
