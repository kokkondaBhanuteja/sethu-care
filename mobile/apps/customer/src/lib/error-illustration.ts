import type { IllustrationName } from "@sethu/ui";

// Pick the clay art for a failed data load: the "no connection" illustration when the failure looks
// like a dropped network (React Native's fetch throws "Network request failed" with no HTTP status),
// otherwise the generic "server error". Avoids a native connectivity dependency.
export function errorIllustration(error: unknown): IllustrationName {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|network error|timed out|timeout|abort/i.test(
    message,
  )
    ? "noConnection"
    : "serverError";
}
