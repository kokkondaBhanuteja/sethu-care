// Mirrors the English admin-console namespaces into hi/te.
//
// The admin console is an internal ops tool with well over a thousand strings, and shipping
// machine-guessed Hindi/Telugu for destructive financial actions would be worse than shipping
// English. So hi/te carry the SAME KEYS with English values until a translator supplies real copy —
// which satisfies `pnpm i18n:check` (it compares key sets, not values) without any component ever
// hardcoding a string.
//
// An existing non-English value is never overwritten: once a key is genuinely translated, this
// script leaves it alone and only fills in what is missing.
//
// Run: node scripts/sync-admin-locales.mjs   (or `pnpm i18n:sync-admin`)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = fileURLToPath(new URL("../packages/i18n/locales", import.meta.url));
const REFERENCE = "en";
const TARGETS = ["hi", "te"];
const PREFIX = "admin-";

function featureFiles(locale) {
  const dir = join(LOCALES_DIR, locale, "features");
  return readdirSync(dir).filter((name) => name.startsWith(PREFIX) && name.endsWith(".json"));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Deep-merge reference keys into target, keeping any value the target already translated. */
function mergeKeys(reference, target) {
  const merged = {};
  let added = 0;

  for (const [key, referenceValue] of Object.entries(reference)) {
    const targetValue = target[key];
    if (referenceValue && typeof referenceValue === "object" && !Array.isArray(referenceValue)) {
      const child = mergeKeys(
        referenceValue,
        targetValue && typeof targetValue === "object" ? targetValue : {},
      );
      merged[key] = child.merged;
      added += child.added;
    } else if (targetValue === undefined) {
      merged[key] = referenceValue;
      added += 1;
    } else {
      merged[key] = targetValue;
    }
  }

  return { merged, added };
}

let totalAdded = 0;
let totalRemoved = 0;

for (const file of featureFiles(REFERENCE)) {
  const reference = readJson(join(LOCALES_DIR, REFERENCE, "features", file));

  for (const locale of TARGETS) {
    const path = join(LOCALES_DIR, locale, "features", file);
    let existing = {};
    try {
      existing = readJson(path);
    } catch {
      // A namespace added since the last sync — start from scratch.
    }

    const { merged, added } = mergeKeys(reference, existing);
    const removed = countKeys(existing) - (countKeys(merged) - added);

    writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    totalAdded += added;
    totalRemoved += Math.max(0, removed);
  }
}

function countKeys(value) {
  return Object.entries(value).reduce((total, [, child]) => {
    if (child && typeof child === "object" && !Array.isArray(child))
      return total + countKeys(child);
    return total + 1;
  }, 0);
}

console.log(
  `admin locales synced: +${totalAdded} key(s) filled with English placeholders, ` +
    `${totalRemoved} stale key(s) dropped.`,
);
