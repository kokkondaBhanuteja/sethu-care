# packages/i18n (@sethu/i18n)

Scope: i18next setup + type-safe resources for en/hi/te. All user-facing text in the product lives here.
Purpose: One localization pipeline: initI18n(language), detectBrowserLanguage(), typed t() keys (wrong key = compile error), locales as namespace JSON per feature area.
Contents: src/config.ts (init + language detection), src/resources.ts (namespace registry + type augmentation), src/index.ts (re-exports incl. useTranslation), locales/{en,hi,te}/.
Business logic: none — text and wiring only.
Dependencies: i18next, react-i18next.
Boundaries: every key exists in ALL THREE locales (pnpm i18n:check gates CI); no Expo/DOM-lib dependencies (structural typing for navigator); apps pass/override the language — this package never reads device APIs.
Impacted modules: every screen with text; a missing locale key fails CI workspace-wide.
