/* eslint-disable @typescript-eslint/no-require-imports -- RN bundles static image assets via require() */
import type { IconName } from "@sethu/ui";

// Service/category imagery for the rich, image-forward home. Drop generated files into
// apps/customer/assets/img/services/ (see docs/image-generation-prompts.md), then map them by slug
// here. Until an image exists, AppImage renders a soft-blue placeholder with the icon from
// serviceIcon() below — so the layout is complete before the art lands.
export const SERVICE_IMAGES: Record<string, number> = {
  // "ac-repair-service": require("../../../assets/img/services/ac-service.png"),
  // electrical: require("../../../assets/img/services/electrical.png"),
  // plumbing: require("../../../assets/img/services/plumbing.png"),
};

export const CATEGORY_IMAGES: Record<string, number> = {
  // "ac-repair": require("../../../assets/img/categories/ac-repair.png"),
};

/** Resolve a bundled image for a service by slug (undefined → AppImage shows the placeholder). */
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
