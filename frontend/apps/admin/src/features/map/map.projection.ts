import type { MapPoint } from "./map.types";

/**
 * The one place feature shapes become MapLibre geometry. Screen projection itself now lives inside
 * the GL map; what remains here is the pure geo arithmetic around it — lng/lat tuples, viewport
 * culling bounds, and the circle rings the overlay layers draw — so every consumer stays testable
 * without a WebGL context.
 */

/** MapLibre wants [longitude, latitude]; GeoJSON agrees. Our own shapes name their axes instead. */
export function toLngLat(point: MapPoint): [number, number] {
  return [point.longitude, point.latitude];
}

/** A camera-independent bounds shape, so culling logic never needs a live map to be exercised. */
export interface PlainBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/** Spec §6.7: only the viewport plus a buffer gets DOM markers. Ratio is per side. */
export function boundsWithBuffer(bounds: PlainBounds, bufferRatio: number): PlainBounds {
  const widthBuffer = (bounds.east - bounds.west) * bufferRatio;
  const heightBuffer = (bounds.north - bounds.south) * bufferRatio;
  return {
    west: bounds.west - widthBuffer,
    south: bounds.south - heightBuffer,
    east: bounds.east + widthBuffer,
    north: bounds.north + heightBuffer,
  };
}

export function isWithinBounds(point: MapPoint, bounds: PlainBounds): boolean {
  return (
    point.longitude >= bounds.west &&
    point.longitude <= bounds.east &&
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north
  );
}

const EARTH_KM_PER_DEGREE_LATITUDE = 110.574;
const EARTH_KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;
const DEGREES_TO_RADIANS = Math.PI / 180;
const FULL_TURN_RADIANS = Math.PI * 2;

/**
 * A closed ring of [lng, lat] positions approximating a circle of `radiusKm` around `centre`.
 * Drawn as GeoJSON so the demand blooms and service boundaries are geographic — they grow and
 * shrink with the tiles instead of floating at a fixed pixel size.
 */
export function circleRingAround(
  centre: MapPoint,
  radiusKm: number,
  stepCount = 48,
): [number, number][] {
  const latitudeRadius = radiusKm / EARTH_KM_PER_DEGREE_LATITUDE;
  const longitudeRadius =
    radiusKm /
    (EARTH_KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(centre.latitude * DEGREES_TO_RADIANS));

  const ring: [number, number][] = [];
  for (let step = 0; step <= stepCount; step += 1) {
    const angle = (step / stepCount) * FULL_TURN_RADIANS;
    ring.push([
      centre.longitude + Math.cos(angle) * longitudeRadius,
      centre.latitude + Math.sin(angle) * latitudeRadius,
    ]);
  }
  return ring;
}
