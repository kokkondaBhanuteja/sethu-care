import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/features/auth.json";
import enBooking from "../locales/en/features/booking.json";
import enJobs from "../locales/en/features/jobs.json";
import hiCommon from "../locales/hi/common.json";
import hiAuth from "../locales/hi/features/auth.json";
import hiBooking from "../locales/hi/features/booking.json";
import hiJobs from "../locales/hi/features/jobs.json";
import teCommon from "../locales/te/common.json";
import teAuth from "../locales/te/features/auth.json";
import teBooking from "../locales/te/features/booking.json";
import teJobs from "../locales/te/features/jobs.json";

import { defaultNS } from "./resources";

export const supportedLanguages = ["en", "hi", "te"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Every locale carries the same namespaces (common + one per feature). Kept eager for now — small,
// and it makes the type-safe keys and CI drift check straightforward. Lazy per-namespace loading
// (i18next-resources-to-backend) is a later optimisation once the trees grow.
const bundledResources = {
  en: { common: enCommon, auth: enAuth, booking: enBooking, jobs: enJobs },
  hi: { common: hiCommon, auth: hiAuth, booking: hiBooking, jobs: hiJobs },
  te: { common: teCommon, auth: teAuth, booking: teBooking, jobs: teJobs },
} as const;

/** Returns true if the given code is a language we ship (narrows to SupportedLanguage). */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(code);
}

/** Initialise i18next once, for the given device language. The app passes the language it read
 *  from expo-localization, so this package stays free of any Expo dependency. */
export function initI18n(language: SupportedLanguage = "en"): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: "en",
      defaultNS,
      ns: ["common", "auth", "booking", "jobs"],
      supportedLngs: [...supportedLanguages],
      resources: bundledResources,
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}
