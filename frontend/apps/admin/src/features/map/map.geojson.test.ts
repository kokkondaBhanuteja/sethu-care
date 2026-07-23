import { describe, expect, it } from "vitest";

import { MAP_JOBS, MAP_PROVIDERS, MAP_ZONES } from "./map.fixtures";
import {
  readRenderedClusterFeatures,
  shouldClusterMarkers,
  toClusterFeatureCollection,
  toDemandHeatCollection,
  toServiceAreaCollection,
} from "./map.geojson";
import { JOB_MAP_STATES } from "./map.types";
import type { MapProvider } from "./map.types";

function fakeProviders(count: number): MapProvider[] {
  return [...Array(count).keys()].map((index) => ({
    id: `FP-${index}`,
    name: `Provider ${index}`,
    status: "online" as const,
    zoneId: "kompally",
    position: { latitude: 17.4 + index / 1000, longitude: 78.4 },
    locatedAt: new Date().toISOString(),
  }));
}

/** The real payload's markers arrive without an invertible position — map.api.map.ts. */
function unpositioned(providers: readonly MapProvider[]): MapProvider[] {
  return providers.map((provider) => ({ ...provider, position: null }));
}

describe("shouldClusterMarkers", () => {
  it("keeps individual buttons up to 50 pins and clusters beyond — spec §6.7", () => {
    expect(shouldClusterMarkers(fakeProviders(50), [])).toBe(false);
    expect(shouldClusterMarkers(fakeProviders(51), [])).toBe(true);
    expect(shouldClusterMarkers(MAP_PROVIDERS, MAP_JOBS)).toBe(false);
  });

  it("counts only markers that can become pins — unpositioned ones never cluster", () => {
    expect(shouldClusterMarkers(unpositioned(fakeProviders(60)), [])).toBe(false);
  });
});

describe("toClusterFeatureCollection", () => {
  const collection = toClusterFeatureCollection(MAP_PROVIDERS, MAP_JOBS);

  it("never feeds an escalated job to the cluster engine — it must stay its own pulse", () => {
    const escalatedIds = MAP_JOBS.filter((job) => job.state === JOB_MAP_STATES.escalated).map(
      (job) => job.id,
    );
    const featureIds = collection.features.map((feature) => feature.properties.markerId);
    expect(escalatedIds.length).toBeGreaterThan(0);
    for (const escalatedId of escalatedIds) {
      expect(featureIds).not.toContain(escalatedId);
    }
    expect(collection.features).toHaveLength(
      MAP_PROVIDERS.length + MAP_JOBS.length - escalatedIds.length,
    );
  });

  it("writes longitude-first coordinates", () => {
    const firstProvider = MAP_PROVIDERS[0];
    const firstFeature = collection.features[0];
    expect(firstFeature?.geometry.coordinates).toEqual([
      firstProvider?.position?.longitude,
      firstProvider?.position?.latitude,
    ]);
  });

  it("never feeds an unpositioned marker to the engine — no coordinate is ever invented", () => {
    const mixed = toClusterFeatureCollection(
      [...unpositioned(fakeProviders(3)), ...MAP_PROVIDERS],
      [],
    );
    expect(mixed.features).toHaveLength(MAP_PROVIDERS.length);
  });
});

describe("readRenderedClusterFeatures", () => {
  it("splits clusters from free pins and dedupes the tile-border repeats", () => {
    const clusterFeature = {
      geometry: { type: "Point", coordinates: [78.4, 17.5] },
      properties: { cluster: true, cluster_id: 7, point_count: 12 },
    };
    const pinFeature = {
      geometry: { type: "Point", coordinates: [78.5, 17.4] },
      properties: { markerId: "P-2041", kind: "provider" },
    };

    const rendered = readRenderedClusterFeatures([
      clusterFeature,
      clusterFeature,
      pinFeature,
      pinFeature,
    ]);

    expect(rendered.clusters).toHaveLength(1);
    expect(rendered.clusters[0]).toEqual({
      clusterId: 7,
      markerCount: 12,
      position: { longitude: 78.4, latitude: 17.5 },
    });
    expect([...rendered.unclusteredMarkerIds]).toEqual(["P-2041"]);
  });
});

describe("overlay collections", () => {
  it("blooms a zone's heat wider the more jobs are running there", () => {
    const busyZone = MAP_ZONES[0];
    if (!busyZone) throw new Error("fixture zone missing");

    const quiet = toDemandHeatCollection([busyZone], []);
    const busy = toDemandHeatCollection([busyZone], MAP_JOBS);

    const widthOf = (ring: readonly (readonly number[])[]): number => {
      const longitudes = ring.map(([longitude]) => longitude ?? 0);
      return Math.max(...longitudes) - Math.min(...longitudes);
    };
    const quietRing = quiet.features[0]?.geometry.coordinates[0] ?? [];
    const busyRing = busy.features[0]?.geometry.coordinates[0] ?? [];
    expect(widthOf(busyRing)).toBeGreaterThan(widthOf(quietRing));
  });

  it("draws one heat pair per zone and one boundary ring per zone", () => {
    expect(toDemandHeatCollection(MAP_ZONES, MAP_JOBS).features).toHaveLength(MAP_ZONES.length * 2);
    expect(toServiceAreaCollection(MAP_ZONES).features).toHaveLength(MAP_ZONES.length);
  });
});
