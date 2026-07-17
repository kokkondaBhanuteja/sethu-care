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
