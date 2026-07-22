import { describe, expect, it } from "vitest";

import { MAP_DEFAULT_LAYERS } from "./map.constants";
import {
  MAP_ATTENTION,
  MAP_CLUSTERS,
  MAP_JOBS,
  MAP_PROVIDERS,
  MAP_ZONES,
  ZONES,
} from "./map.fixtures";
import {
  isMapFiltered,
  isMarkerSetEmpty,
  selectVisibleMarkers,
  zeroSupplyZoneNames,
} from "./map.selectors";
import { JOB_MAP_STATES } from "./map.types";
import type { LiveMapSnapshot } from "./map.types";

// The selector is what the canvas AND the keyboard list both render, so its behaviour is the
// screen's behaviour (folder CLAUDE.md: one derived set, two renderings).

const snapshot: LiveMapSnapshot = {
  observedAt: new Date().toISOString(),
  activeJobCount: 42,
  onlineProviderCount: 18,
  zones: MAP_ZONES,
  providers: MAP_PROVIDERS,
  jobs: MAP_JOBS,
  clusters: MAP_CLUSTERS,
  attention: MAP_ATTENTION,
  zeroSupplyZoneIds: [ZONES.kompally],
};

describe("selectVisibleMarkers", () => {
  it("shows everything under the default layers", () => {
    const markers = selectVisibleMarkers(snapshot, MAP_DEFAULT_LAYERS, null);
    expect(markers.providers).toHaveLength(MAP_PROVIDERS.length);
    expect(markers.jobs).toHaveLength(MAP_JOBS.length);
    expect(markers.clusters).toHaveLength(MAP_CLUSTERS.length);
  });

  it("escalations-only strips providers and clusters too — a filtered map must look filtered", () => {
    const markers = selectVisibleMarkers(
      snapshot,
      { ...MAP_DEFAULT_LAYERS, escalationsOnly: true },
      null,
    );
    expect(markers.providers).toHaveLength(0);
    expect(markers.clusters).toHaveLength(0);
    expect(markers.jobs.every((job) => job.state === JOB_MAP_STATES.escalated)).toBe(true);
    expect(markers.jobs.length).toBeGreaterThan(0);
  });

  it("focusing a zone narrows every list to it and dissolves clusters into the list", () => {
    const markers = selectVisibleMarkers(snapshot, MAP_DEFAULT_LAYERS, ZONES.miyapur);
    expect(markers.providers.every((provider) => provider.zoneId === ZONES.miyapur)).toBe(true);
    expect(markers.jobs.every((job) => job.zoneId === ZONES.miyapur)).toBe(true);
    expect(markers.clusters).toHaveLength(0);
  });

  it("turning every layer off leaves a genuinely empty marker set (minus attention)", () => {
    const markers = selectVisibleMarkers(
      snapshot,
      { ...MAP_DEFAULT_LAYERS, activeJobs: false, providersOnline: false },
      null,
    );
    expect(markers.providers).toHaveLength(0);
    expect(markers.jobs).toHaveLength(0);
    expect(markers.clusters).toHaveLength(0);
    expect(isMarkerSetEmpty({ ...markers, attention: [] })).toBe(true);
  });
});

describe("isMapFiltered", () => {
  it("reads defaults as unfiltered, and any layer change or zone focus as filtered", () => {
    expect(isMapFiltered(MAP_DEFAULT_LAYERS, null)).toBe(false);
    expect(isMapFiltered({ ...MAP_DEFAULT_LAYERS, demandHeatmap: true }, null)).toBe(true);
    expect(isMapFiltered(MAP_DEFAULT_LAYERS, ZONES.kompally)).toBe(true);
  });
});

describe("zeroSupplyZoneNames", () => {
  it("names the zone the banner warns about", () => {
    expect(zeroSupplyZoneNames(snapshot)).toEqual(["Kompally"]);
  });
});
