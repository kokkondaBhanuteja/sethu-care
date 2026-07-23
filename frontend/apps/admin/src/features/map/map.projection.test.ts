import { describe, expect, it } from "vitest";

import { FIXTURE_GEO_BOUNDS, MAP_JOBS, MAP_PROVIDERS, MAP_ZONES } from "./map.fixtures";
import { boundsWithBuffer, circleRingAround, isWithinBounds, toLngLat } from "./map.projection";
import type { PlainBounds } from "./map.projection";

describe("toLngLat", () => {
  it("orders the tuple longitude-first, the way MapLibre and GeoJSON expect", () => {
    expect(toLngLat({ latitude: 17.44, longitude: 78.45 })).toEqual([78.45, 17.44]);
  });
});

describe("boundsWithBuffer", () => {
  const bounds: PlainBounds = { west: 78.3, south: 17.3, east: 78.5, north: 17.5 };

  it("grows every side by the ratio — spec §6.7's viewport plus 20%", () => {
    const buffered = boundsWithBuffer(bounds, 0.2);
    expect(buffered.west).toBeCloseTo(78.26);
    expect(buffered.east).toBeCloseTo(78.54);
    expect(buffered.south).toBeCloseTo(17.26);
    expect(buffered.north).toBeCloseTo(17.54);
  });

  it("keeps a point just outside the frame renderable, and one far away culled", () => {
    const buffered = boundsWithBuffer(bounds, 0.2);
    expect(isWithinBounds({ latitude: 17.52, longitude: 78.4 }, bounds)).toBe(false);
    expect(isWithinBounds({ latitude: 17.52, longitude: 78.4 }, buffered)).toBe(true);
    expect(isWithinBounds({ latitude: 18.2, longitude: 78.4 }, buffered)).toBe(false);
  });
});

describe("circleRingAround", () => {
  const centre = { latitude: 17.44, longitude: 78.45 };

  it("closes the ring, so the polygon and line layers accept it", () => {
    const ring = circleRingAround(centre, 2);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("spans roughly the asked-for radius in latitude degrees", () => {
    const ring = circleRingAround(centre, 2);
    const latitudes = ring.map(([, latitude]) => latitude);
    const spanDegrees = Math.max(...latitudes) - Math.min(...latitudes);
    // 2km radius → 4km diameter ≈ 0.036° of latitude.
    expect(spanDegrees).toBeCloseTo(0.036, 2);
  });
});

describe("fixture geography", () => {
  it("puts every mock marker inside the Hyderabad-area box the artifacts were mapped onto", () => {
    const positions = [
      ...MAP_PROVIDERS.map((provider) => provider.position),
      ...MAP_JOBS.map((job) => job.position),
      ...MAP_ZONES.map((zone) => zone.labelAt),
    ];
    for (const position of positions) {
      // Every FIXTURE marker is positioned — only the real payload's markers may carry null.
      expect(position).not.toBeNull();
      if (position === null) continue;
      expect(isWithinBounds(position, FIXTURE_GEO_BOUNDS)).toBe(true);
    }
  });
});
