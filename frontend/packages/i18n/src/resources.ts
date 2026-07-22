// The CANONICAL resource map — English is the source of truth that the type-safe keys are
// generated from (see i18next.d.ts). Other locales are validated against these keys by CI
// (pnpm i18n:check), not by the compiler.

import { en } from "./bundles/en";

export const defaultNS = "common" as const;

/** Namespaces mirror the app's feature folders (the "shadow" tree): common + one per feature.
 *  The `admin*` namespaces belong to apps/admin's feature folders. */
export const resources = en;

export type AppResources = typeof resources;

/** Every namespace the apps may load, derived from the canonical bundle so the two never drift. */
export const namespaces = Object.keys(en) as readonly (keyof typeof en)[];
