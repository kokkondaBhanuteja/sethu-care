import type { MapPoint, MapViewport } from "./map.types";

/**
 * The one place map coordinates become screen coordinates.
 *
 * The abstract SVG surface and a future tile layer differ only here: this projects a percentage
 * point through a centre + zoom, a tile layer would project lat/lng through the same viewport. Both
 * hand the marker layer a left/top pair, so MapSurface's children never learn which surface they
 * are sitting on.
 */

const MIDPOINT_PERCENT = 50;

export interface ScreenOffset {
  /** CSS `left`, already in percent — the units `.map-marker` positions itself in. */
  readonly leftPercent: number;
  readonly topPercent: number;
}

export function projectPoint(point: MapPoint, viewport: MapViewport): ScreenOffset {
  return {
    leftPercent: project(point.xPercent, viewport.centre.xPercent, viewport.zoom),
    topPercent: project(point.yPercent, viewport.centre.yPercent, viewport.zoom),
  };
}

function project(value: number, centre: number, zoom: number): number {
  return MIDPOINT_PERCENT + (value - centre) * zoom;
}

/**
 * The same transform expressed for CSS, so the base grid moves with the markers instead of being
 * re-projected path by path. Equivalent to `projectPoint` because a `translate` then `scale` about
 * the box centre resolves to `50 + (value - centre) * zoom` for every point in the layer.
 */
export function viewportTransform(viewport: MapViewport): string {
  const offsetX = (MIDPOINT_PERCENT - viewport.centre.xPercent) * viewport.zoom;
  const offsetY = (MIDPOINT_PERCENT - viewport.centre.yPercent) * viewport.zoom;
  return `translate(${offsetX}%, ${offsetY}%) scale(${viewport.zoom})`;
}

/** A marker outside the rendered box is not drawn — spec §6.7's "viewport plus a 20% buffer". */
const VIEWPORT_BUFFER_PERCENT = 20;

export function isWithinViewport(offset: ScreenOffset): boolean {
  return (
    offset.leftPercent >= -VIEWPORT_BUFFER_PERCENT &&
    offset.leftPercent <= 100 + VIEWPORT_BUFFER_PERCENT &&
    offset.topPercent >= -VIEWPORT_BUFFER_PERCENT &&
    offset.topPercent <= 100 + VIEWPORT_BUFFER_PERCENT
  );
}
