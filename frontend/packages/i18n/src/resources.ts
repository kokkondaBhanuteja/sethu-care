// The CANONICAL resource map — English is the source of truth that the type-safe keys are
// generated from (see i18next.d.ts). Other locales are validated against these keys by CI
// (i18next-cli status), not by the compiler.

import common from "../locales/en/common.json";
import auth from "../locales/en/features/auth.json";
import booking from "../locales/en/features/booking.json";
import jobs from "../locales/en/features/jobs.json";

export const defaultNS = "common" as const;

/** Namespaces mirror the app's feature folders (the "shadow" tree): common + one per feature. */
export const resources = {
  common,
  auth,
  booking,
  jobs,
} as const;

export type AppResources = typeof resources;
