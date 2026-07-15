// Type-safe translation keys. This augments i18next's CustomTypeOptions with the shape of the
// canonical (English) resources, so `t('auth:signIn.title')` autocompletes and a wrong key is a
// COMPILE ERROR. Extends the same correctness-by-construction the backend uses.

import "i18next";
import type { resources, defaultNS } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: typeof resources;
  }
}
