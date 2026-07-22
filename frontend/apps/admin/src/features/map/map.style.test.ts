import { describe, expect, it } from "vitest";

import {
  buildBaseMapStyle,
  OSM_ATTRIBUTION,
  OSM_RASTER_LAYER_ID,
  OSM_SOURCE_ID,
  OSM_TILE_MAX_ZOOM,
} from "./map.style";
import type { RasterLayerSpecification, RasterSourceSpecification } from "maplibre-gl";

// The style is the licensing and design contract in code form: OSM tiles, the mandatory credit,
// and the quiet-gray treatment that keeps a 12px marker louder than the ground under it.

describe("buildBaseMapStyle", () => {
  const style = buildBaseMapStyle();
  const source = style.sources[OSM_SOURCE_ID] as RasterSourceSpecification;
  const rasterLayer = style.layers.find(
    (layer) => layer.id === OSM_RASTER_LAYER_ID,
  ) as RasterLayerSpecification;

  it("serves OpenStreetMap raster tiles up to zoom 19", () => {
    expect(source.type).toBe("raster");
    expect(source.tiles).toEqual(["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]);
    expect(source.maxzoom).toBe(19);
    expect(OSM_TILE_MAX_ZOOM).toBe(19);
  });

  it("carries the OSM credit on the source — the licensing condition for using the tiles", () => {
    expect(source.attribution).toBe(OSM_ATTRIBUTION);
    expect(OSM_ATTRIBUTION).toContain("OpenStreetMap");
    expect(OSM_ATTRIBUTION).toContain("contributors");
    expect(OSM_ATTRIBUTION).toContain("https://www.openstreetmap.org/copyright");
  });

  it("desaturates the base so no tile colour can out-shout a marker (BOX 24/41)", () => {
    expect(rasterLayer.paint?.["raster-saturation"]).toBe(-0.9);
    expect(rasterLayer.paint?.["raster-contrast"]).toBe(-0.2);
    expect(rasterLayer.paint?.["raster-opacity"]).toBe(0.9);
  });

  it("is a complete style on its own — no external style, glyph or sprite fetches", () => {
    expect(style.version).toBe(8);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(style.layers).toHaveLength(1);
  });
});
