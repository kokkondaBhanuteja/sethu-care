import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { MOBILE_TABS, SIDEBAR_GROUPS } from "../../src/layouts/navigation.constants";

/**
 * Read rather than `import`: the specs run as ESM under Playwright, where a JSON import needs an
 * import attribute that the TS transform does not emit. The file is the same one the app renders
 * from, so the labels asserted here cannot drift from the labels shipped.
 */
const adminShellEn: unknown = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../../packages/i18n/locales/en/features/admin-shell.json", import.meta.url),
    ),
    "utf8",
  ),
);

/**
 * The navigation destinations, resolved from the app's own `navigation.constants.ts` and the en
 * locale it renders with. Nothing here is a hand-copied list: a sidebar item added without a label
 * key, or with a key that has no English string, fails at collection time.
 */

export interface NavDestination {
  readonly label: string;
  readonly to: string;
  readonly hasBadge: boolean;
}

/** The namespace mixes flat strings and nested objects, so it is walked rather than indexed. */
function label(labelKey: string): string {
  const namespace: unknown = adminShellEn;
  const text = labelKey
    .split(".")
    .reduce<unknown>(
      (branch, segment) =>
        typeof branch === "object" && branch !== null
          ? (branch as Record<string, unknown>)[segment]
          : undefined,
      namespace,
    );

  if (typeof text !== "string") throw new Error(`No en string for adminShell:${labelKey}`);
  return text;
}

export const SIDEBAR_DESTINATIONS: readonly NavDestination[] = SIDEBAR_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    label: label(item.labelKey),
    to: item.to,
    hasBadge: item.badge !== undefined,
  })),
);

export const SIDEBAR_GROUP_TITLES: readonly string[] = SIDEBAR_GROUPS.map((group) =>
  label(group.titleKey),
);

export const TAB_DESTINATIONS: readonly NavDestination[] = MOBILE_TABS.map((tab) => ({
  label: label(tab.labelKey),
  to: tab.to,
  hasBadge: tab.badge !== undefined,
}));
