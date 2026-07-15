export { initI18n, isSupportedLanguage, supportedLanguages } from "./config";
export type { SupportedLanguage } from "./config";
export { defaultNS, resources } from "./resources";
export type { AppResources } from "./resources";

// Re-export the React bindings so screens import everything i18n-related from one place.
export { useTranslation, Trans, I18nextProvider } from "react-i18next";
