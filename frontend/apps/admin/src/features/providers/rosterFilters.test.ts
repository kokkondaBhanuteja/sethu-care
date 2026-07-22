import { describe, expect, it } from "vitest";

import {
  EMPTY_ROSTER_REFINEMENTS,
  ROSTER_FILTER_ALL,
  isRosterRefined,
  refineRosterRows,
  rosterFilterOptions,
} from "./rosterFilters";
import { PROVIDER_STATUSES, type ProviderRosterRow } from "./providers.types";

function makeRow(overrides: Partial<ProviderRosterRow>): ProviderRosterRow {
  return {
    id: "PRV-1",
    name: "Test Provider",
    status: PROVIDER_STATUSES.free,
    skills: ["Plumbing"],
    zone: "Kompally",
    jobsToday: 0,
    earningsTodayPaise: 0,
    rating: 4.5,
    completionRate: 0.96,
    lastSeenAt: null,
    ...overrides,
  };
}

const rows: readonly ProviderRosterRow[] = [
  makeRow({ id: "PRV-1", skills: ["Plumbing", "Electrical"], zone: "Kompally" }),
  makeRow({ id: "PRV-2", skills: ["Cleaning"], zone: "Madhapur", status: PROVIDER_STATUSES.onJob }),
  makeRow({
    id: "PRV-3",
    skills: ["Plumbing"],
    zone: "Madhapur",
    status: PROVIDER_STATUSES.offline,
  }),
];

describe("refineRosterRows", () => {
  it("returns every row when nothing is refined", () => {
    expect(refineRosterRows(rows, EMPTY_ROSTER_REFINEMENTS)).toHaveLength(3);
  });

  it("filters by skill membership, zone equality and status together", () => {
    const refined = refineRosterRows(rows, {
      skill: "Plumbing",
      zone: "Madhapur",
      status: ROSTER_FILTER_ALL,
    });
    expect(refined.map((row) => row.id)).toEqual(["PRV-3"]);
  });

  it("filters by status alone", () => {
    const refined = refineRosterRows(rows, {
      ...EMPTY_ROSTER_REFINEMENTS,
      status: PROVIDER_STATUSES.onJob,
    });
    expect(refined.map((row) => row.id)).toEqual(["PRV-2"]);
  });
});

describe("isRosterRefined", () => {
  it("is false for the empty refinements and true once any control moves", () => {
    expect(isRosterRefined(EMPTY_ROSTER_REFINEMENTS)).toBe(false);
    expect(isRosterRefined({ ...EMPTY_ROSTER_REFINEMENTS, zone: "Kompally" })).toBe(true);
  });
});

describe("rosterFilterOptions", () => {
  it("derives sorted, de-duplicated skills and zones from the rows", () => {
    const options = rosterFilterOptions(rows);
    expect(options.skills).toEqual(["Cleaning", "Electrical", "Plumbing"]);
    expect(options.zones).toEqual(["Kompally", "Madhapur"]);
  });
});
