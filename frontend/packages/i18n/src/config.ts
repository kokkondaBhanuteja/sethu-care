import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "./bundles/en";
import { hi } from "./bundles/hi";
import { te } from "./bundles/te";
import { defaultNS, namespaces } from "./resources";

export const supportedLanguages = ["en", "hi", "te"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Every locale carries the same namespaces (common + one per feature area). Kept eager for now —
// small, and it makes the type-safe keys and CI drift check straightforward. Lazy per-namespace
// loading (i18next-resources-to-backend) is a later optimisation once the trees grow.
const bundledResources = { en, hi, te } as const;

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

/** Initialise i18next once, for the given device language. The app passes the language it read
 *  from expo-localization, so this package stays free of any Expo dependency. */
export function initI18n(language: SupportedLanguage = "en"): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: "en",
      defaultNS,
      ns: [...namespaces],
      supportedLngs: [...supportedLanguages],
      resources: bundledResources,
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}
