import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "./bundles/en";
import { defaultNS, namespaces } from "./resources";

export const supportedLanguages = ["en", "hi", "te"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// English is bundled; Hindi and Telugu are fetched on demand.
//
// The three locales together are ~255 KB of JSON, and bundling all of them shipped ~174 KB of
// translations to every user who reads none of them — the single largest item in the admin
// console's entry chunk, against a <2s cold-start budget on a mid-range Android (Admin spec §2.4).
//
// English stays static because it is both the default and the fallback: it must be present before
// the first render, or the first paint is empty keys. The other two arrive as their own chunk and
// are swapped in when the language is actually selected. Until one lands, i18next falls back to
// English — a correct intermediate state, not a flash of missing text.

const loadedLanguages = new Set<SupportedLanguage>(["en"]);

/** Returns true if the given code is a language we ship (narrows to SupportedLanguage). */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(code);
}

/** Best-effort browser/WebView language detection (navigator.language → primary subtag),
 *  falling back to English. Typed structurally so this package needs no DOM lib — it also runs
 *  in Node (SSR/tests). The Capacitor apps may override with a device-locale bridge later. */
export function detectBrowserLanguage(): SupportedLanguage {
  const nav = (globalThis as { navigator?: { language?: string } }).navigator;
  const raw = nav?.language ?? "en";
  const primary = raw.toLowerCase().split("-")[0] ?? "en";
  return isSupportedLanguage(primary) ? primary : "en";
}

async function importBundle(
  language: Exclude<SupportedLanguage, "en">,
): Promise<Record<string, Record<string, unknown>>> {
  // Two literal specifiers rather than a template, so the bundler can see both chunks statically.
  if (language === "hi") return (await import("./bundles/hi")).hi;
  return (await import("./bundles/te")).te;
}

/**
 * Fetch a locale's namespaces and make it active. Safe to call repeatedly — the second call for a
 * language that is already loaded only switches to it.
 */
export async function loadLanguage(language: SupportedLanguage): Promise<void> {
  if (language !== "en" && !loadedLanguages.has(language)) {
    const bundle = await importBundle(language);
    for (const [namespace, resources] of Object.entries(bundle)) {
      i18n.addResourceBundle(language, namespace, resources, true, true);
    }
    loadedLanguages.add(language);
  }
  if (i18n.language !== language) await i18n.changeLanguage(language);
}

/**
 * Initialise i18next once, for the given language. Synchronous by design: callers render
 * immediately in English and the requested locale swaps in when its chunk arrives.
 */
export function initI18n(language: SupportedLanguage = "en"): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      // Always boots in English — the only locale present at this point. `loadLanguage` below
      // switches once the requested chunk resolves.
      lng: "en",
      fallbackLng: "en",
      defaultNS,
      ns: [...namespaces],
      supportedLngs: [...supportedLanguages],
      resources: { en },
      interpolation: { escapeValue: false },
    });
  }
  if (language !== "en") void loadLanguage(language);
  return i18n;
}
