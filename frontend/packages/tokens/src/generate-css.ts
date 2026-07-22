// Emits the global Tailwind v4 `@theme` file from web.ts into @sethu/ui-web. Run via
// `pnpm --filter @sethu/tokens run generate:css`; CI diffs the output (drift guard), so a token
// change that skips regeneration fails the build — the same discipline as the generated API client.
//
// Runs directly under Node >=22.6 type-stripping (`node --experimental-strip-types`); no build step.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { webAccent, webColor, webRadius, webShadow, webText, webTone } from "./web.ts";

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../ui-web/src/styles/tokens.css",
);

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const lines: string[] = [
  "/* GENERATED from @sethu/tokens (src/web.ts) — DO NOT EDIT.",
  " * Regenerate: pnpm --filter @sethu/tokens run generate:css",
  " * This is the ONLY place visual values enter the web surfaces: Tailwind v4 reads this @theme",
  " * and exposes every entry as token-backed utilities (bg-canvas, text-success-fg, rounded-card,",
  " * shadow-lifted, text-kpi, …). Components never hardcode a visual value. */",
  "",
  "@theme {",
  "  /* Colour — canvas, ink, brand */",
];

for (const [name, value] of Object.entries(webColor)) {
  lines.push(`  --color-${kebab(name)}: ${value};`);
}
lines.push("", "  /* Tones — tinted bg / saturated fg / border, per status + feature tint */");
for (const [tone, parts] of Object.entries(webTone)) {
  for (const [part, value] of Object.entries(parts)) {
    lines.push(`  --color-${kebab(tone)}-${part}: ${value};`);
  }
}
lines.push("", "  /* Vivid accents — icon chips, chart series (solid fills, white glyphs) */");
for (const [name, value] of Object.entries(webAccent)) {
  lines.push(`  --color-accent-${kebab(name)}: ${value};`);
}
lines.push("", "  /* Radii */");
for (const [name, value] of Object.entries(webRadius)) {
  lines.push(`  --radius-${kebab(name)}: ${value};`);
}
lines.push("", "  /* Elevation */");
for (const [name, value] of Object.entries(webShadow)) {
  lines.push(`  --shadow-${kebab(name)}: ${value};`);
}
lines.push("", "  /* Type additions (KPI numbers, table header caption) */");
for (const [name, [size, lineHeight]] of Object.entries(webText)) {
  lines.push(`  --text-${kebab(name)}: ${size};`);
  lines.push(`  --text-${kebab(name)}--line-height: ${lineHeight};`);
}
lines.push("}", "");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join("\n"));
console.log(`tokens.css written: ${outputPath}`);
