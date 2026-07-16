// i18n drift guard: every locale must carry exactly the same keys as the reference (English).
// A missing key means an untranslated string; an extra key means a stale one. Dependency-free so
// it runs anywhere (locally via `pnpm i18n:check`, and in CI). Exits non-zero on any mismatch.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = fileURLToPath(new URL("../packages/i18n/locales", import.meta.url));
const REFERENCE = "en";

function flatten(value, prefix = "") {
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      keys.push(...flatten(child, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

// Map every *.json under a locale dir to its set of flattened keys, keyed by path relative to the
// locale (so en/features/booking.json is compared against hi/features/booking.json).
function keysByFile(localeDir) {
  const files = {};
  function walk(dir, relative = "") {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relativePath = relative ? `${relative}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, relativePath);
      } else if (entry.endsWith(".json")) {
        files[relativePath] = new Set(flatten(JSON.parse(readFileSync(full, "utf8"))));
      }
    }
  }
  walk(localeDir);
  return files;
}

const locales = readdirSync(LOCALES_DIR).filter((entry) =>
  statSync(join(LOCALES_DIR, entry)).isDirectory(),
);
const reference = keysByFile(join(LOCALES_DIR, REFERENCE));
let problems = 0;

for (const locale of locales) {
  if (locale === REFERENCE) continue;
  const current = keysByFile(join(LOCALES_DIR, locale));
  for (const [file, referenceKeys] of Object.entries(reference)) {
    const currentKeys = current[file];
    if (!currentKeys) {
      console.error(`[${locale}] missing file: ${file}`);
      problems += 1;
      continue;
    }
    for (const key of referenceKeys) {
      if (!currentKeys.has(key)) {
        console.error(`[${locale}] missing key: ${file} -> ${key}`);
        problems += 1;
      }
    }
    for (const key of currentKeys) {
      if (!referenceKeys.has(key)) {
        console.error(`[${locale}] extra key: ${file} -> ${key}`);
        problems += 1;
      }
    }
  }
}

if (problems > 0) {
  console.error(`\ni18n check FAILED: ${problems} problem(s) across locales.`);
  process.exit(1);
}
console.log(`i18n check passed: every locale matches "${REFERENCE}".`);
