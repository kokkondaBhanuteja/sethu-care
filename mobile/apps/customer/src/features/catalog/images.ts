/* eslint-disable @typescript-eslint/no-require-imports -- RN bundles static image assets via require() */
import type { IconName } from "@sethu/ui";

// The finalized clay service icons (assets/images/services/), keyed by the backend service slug.
// Any service whose slug isn't here falls back to a soft-blue tile with the serviceIcon() glyph.
export const SERVICE_IMAGES: Record<string, number> = {
  "ac-repair": require("../../../assets/images/services/ac-repair.png"),
  electrical: require("../../../assets/images/services/electrical.png"),
  plumbing: require("../../../assets/images/services/plumbing.png"),
  "air-cooler": require("../../../assets/images/services/air-cooler.png"),
  "ceiling-fan": require("../../../assets/images/services/ceiling-fan.png"),
  chimney: require("../../../assets/images/services/chimney.png"),
  "gas-stove": require("../../../assets/images/services/gas-stove.png"),
  geyser: require("../../../assets/images/services/geyser.png"),
  handyman: require("../../../assets/images/services/handyman.png"),
  inverter: require("../../../assets/images/services/inverter.png"),
  microwave: require("../../../assets/images/services/microwave.png"),
  refrigerator: require("../../../assets/images/services/refrigerator.png"),
  "tv-install": require("../../../assets/images/services/tv-install.png"),
  "washing-machine": require("../../../assets/images/services/washing-machine.png"),
  "water-purifier": require("../../../assets/images/services/water-purifier.png"),
};

/** Resolve a bundled clay icon for a service by slug (undefined → AppImage shows the glyph fallback). */
export function serviceImage(slug?: string | null): number | undefined {
  if (!slug) return undefined;
  return SERVICE_IMAGES[slug];
}

// Real photography (Unsplash) keyed by slug — used cover-filled on the image-forward surfaces (the
// popular-service cards and the service-detail hero), Urban-Company style. The clay icons above stay
// on the small category tiles. Any unmapped slug falls back to the clay icon, then the glyph.
export const SERVICE_PHOTOS: Record<string, number> = {
  "ac-repair": require("../../../assets/images/services/photos/ac-repair.jpg"),
  electrical: require("../../../assets/images/services/photos/electrical.jpg"),
  plumbing: require("../../../assets/images/services/photos/plumbing.jpg"),
  "air-cooler": require("../../../assets/images/services/photos/air-cooler.jpg"),
  "ceiling-fan": require("../../../assets/images/services/photos/ceiling-fan.jpg"),
  chimney: require("../../../assets/images/services/photos/chimney.jpg"),
  "gas-stove": require("../../../assets/images/services/photos/gas-stove.jpg"),
  geyser: require("../../../assets/images/services/photos/geyser.jpg"),
  handyman: require("../../../assets/images/services/photos/handyman.jpg"),
  inverter: require("../../../assets/images/services/photos/inverter.jpg"),
  microwave: require("../../../assets/images/services/photos/microwave.jpg"),
  refrigerator: require("../../../assets/images/services/photos/refrigerator.jpg"),
  "tv-install": require("../../../assets/images/services/photos/tv-install.jpg"),
  "washing-machine": require("../../../assets/images/services/photos/washing-machine.jpg"),
  "water-purifier": require("../../../assets/images/services/photos/water-purifier.jpg"),
};

/** Resolve a real service photo by slug, falling back to the clay icon (then undefined → glyph). */
export function servicePhoto(slug?: string | null): number | undefined {
  if (!slug) return undefined;
  return SERVICE_PHOTOS[slug] ?? SERVICE_IMAGES[slug];
}

// Map a service to a representative Phosphor glyph (placeholder tile + category chip). Keyword-based
// so new services get a sensible icon without a config change.
const KEYWORD_ICONS: Array<[RegExp, IconName]> = [
  [/\bac\b|air|cool|snow/i, "snowflake"],
  [/plumb|pipe|tap|leak|water|ro\b/i, "drop"],
  [/electric|w. ?ring|wiring|switch|fan|light/i, "lightning"],
  [/clean|home|handy/i, "home"],
];

export function serviceIcon(name?: string | null): IconName {
  const label = name ?? "";
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(label)) return icon;
  }
  return "service";
}

/** A stable placeholder rating per service (deterministic hash → 4.6–4.9). Wire to real reviews later. */
export function sampleRating(seed?: string | null): number {
  const text = seed ?? "";
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 1000;
  }
  return 4.6 + (hash % 4) * 0.1;
}
