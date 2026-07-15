import { getLocales } from "expo-localization";
import { initI18n, isSupportedLanguage } from "@sethu/i18n";

// Initialise i18n in the device's language when we ship it (en/hi/te), falling back to English.
export function initAppI18n() {
  const deviceLanguage = getLocales()[0]?.languageCode ?? "en";
  return initI18n(isSupportedLanguage(deviceLanguage) ? deviceLanguage : "en");
}
