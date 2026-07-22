import type { StyleSpecification } from "maplibre-gl";

/**
 * The base map style, built in code rather than fetched: one raster source of OpenStreetMap tiles,
 * heavily desaturated. The design rule that shaped the old hand-drawn grid SURVIVES the swap to
 * real tiles — the base map must recede far enough that a 12px marker wins the eye, and no tile's
 * own reds, greens and yellows may out-shout a marker (BOX 24/41). Hence the treatment below:
 * saturation nearly removed, contrast and opacity eased, so the ground reads as a quiet gray city.
 */

export const OSM_SOURCE_ID = "osm-base";
export const OSM_RASTER_LAYER_ID = "osm-base-layer";

export const OSM_RASTER_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_TILE_SIZE = 256;
export const OSM_TILE_MAX_ZOOM = 19;

/**
 * Required by the OSM licensing policy (ODbL): the credit must be visible on every map that uses
 * OSM data. Legal text, rendered verbatim by MapLibre's attribution control — never translated,
 * never hidden behind a compact toggle.
 */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** The quiet-gray treatment. -1 saturation is grayscale; -0.9 keeps a whisper of hue for water. */
export const OSM_RASTER_SATURATION = -0.9;
export const OSM_RASTER_CONTRAST = -0.2;
export const OSM_RASTER_OPACITY = 0.9;

export function buildBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      [OSM_SOURCE_ID]: {
        type: "raster",
        tiles: [OSM_RASTER_TILE_URL],
        tileSize: OSM_TILE_SIZE,
        maxzoom: OSM_TILE_MAX_ZOOM,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: OSM_RASTER_LAYER_ID,
        type: "raster",
        source: OSM_SOURCE_ID,
        paint: {
          "raster-saturation": OSM_RASTER_SATURATION,
          "raster-contrast": OSM_RASTER_CONTRAST,
          "raster-opacity": OSM_RASTER_OPACITY,
        },
      },
    ],
  };
}
