/* eslint-disable @typescript-eslint/no-require-imports -- RN bundles static image assets via require() */
import type { IconName } from "./components/Icon";

// SHARED service imagery for every app (customer, provider, …). Clay icons keyed by backend slug; a
// slug with no entry falls back to a soft-blue tile with the serviceIcon() glyph. Lives in @sethu/ui
// so all apps reuse the same art.
export const SERVICE_IMAGES: Record<string, number> = {
  "ac-repair": require("../assets/services/ac-repair.png"),
  electrical: require("../assets/services/electrical.png"),
  plumbing: require("../assets/services/plumbing.png"),
  "air-cooler": require("../assets/services/air-cooler.png"),
  "ceiling-fan": require("../assets/services/ceiling-fan.png"),
  chimney: require("../assets/services/chimney.png"),
  "gas-stove": require("../assets/services/gas-stove.png"),
  geyser: require("../assets/services/geyser.png"),
  handyman: require("../assets/services/handyman.png"),
  inverter: require("../assets/services/inverter.png"),
  microwave: require("../assets/services/microwave.png"),
  refrigerator: require("../assets/services/refrigerator.png"),
  "tv-install": require("../assets/services/tv-install.png"),
  "washing-machine": require("../assets/services/washing-machine.png"),
  "water-purifier": require("../assets/services/water-purifier.png"),
};

/** Resolve a bundled clay icon for a service by slug (undefined → AppImage shows the glyph fallback). */
export function serviceImage(slug?: string | null): number | undefined {
  if (!slug) return undefined;
  return SERVICE_IMAGES[slug];
}

// Real photography (Unsplash) keyed by slug — used cover-filled on image-forward surfaces (popular
// cards, the hero photo slides, the service-detail hero). Falls back to the clay icon, then the glyph.
export const SERVICE_PHOTOS: Record<string, number> = {
  "ac-repair": require("../assets/services/photos/ac-repair.jpg"),
  electrical: require("../assets/services/photos/electrical.jpg"),
  plumbing: require("../assets/services/photos/plumbing.jpg"),
  "air-cooler": require("../assets/services/photos/air-cooler.jpg"),
  "ceiling-fan": require("../assets/services/photos/ceiling-fan.jpg"),
  chimney: require("../assets/services/photos/chimney.jpg"),
  "gas-stove": require("../assets/services/photos/gas-stove.jpg"),
  geyser: require("../assets/services/photos/geyser.jpg"),
  handyman: require("../assets/services/photos/handyman.jpg"),
  inverter: require("../assets/services/photos/inverter.jpg"),
  microwave: require("../assets/services/photos/microwave.jpg"),
  refrigerator: require("../assets/services/photos/refrigerator.jpg"),
  "tv-install": require("../assets/services/photos/tv-install.jpg"),
  "washing-machine": require("../assets/services/photos/washing-machine.jpg"),
  "water-purifier": require("../assets/services/photos/water-purifier.jpg"),
};

/** Resolve a real service photo by slug, falling back to the clay icon (then undefined → glyph). */
export function servicePhoto(slug?: string | null): number | undefined {
  if (!slug) return undefined;
  return SERVICE_PHOTOS[slug] ?? SERVICE_IMAGES[slug];
}

// The waving handyman mascot (transparent PNG) for hero banners — sits directly on a blue card.
export const heroMascot = require("../assets/services/technician.png");

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
