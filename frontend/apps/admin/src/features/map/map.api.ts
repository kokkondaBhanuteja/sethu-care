// The one boundary between the map and its data.
//
// `GET /ops/live-map` is real (backend admin_map.go → ops.LiveMap) and served through the
// generated client when mocks are off; the mock branch is untouched, so unit tests and e2e runs
// behave exactly as before. The real payload's positions are bounding-box percentages the client
// cannot invert (see map.api.map.ts — the coordinate gap), so real markers reach the lists and
// the counts but not the canvas; positions remain a mock-branch capability until the backend
// ships coordinates the MapLibre surface can carry.

import { opsLiveMap } from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import { mapLiveMapSnapshot } from "./map.api.map";
import { MAX_DOM_MARKERS } from "./map.constants";
import { fetchLiveMapSnapshotMock } from "./map.mock";
import type { LiveMapSnapshot } from "./map.types";

export async function fetchLiveMapSnapshot(signal?: AbortSignal): Promise<LiveMapSnapshot> {
  try {
    if (env.useMocks) return await fetchLiveMapSnapshotMock(signal);

    // The viewport params exist in the contract but the server returns the whole city today;
    // the limit mirrors the console's own hard cap (spec §6.7).
    const result = await opsLiveMap({ query: { limit: MAX_DOM_MARKERS }, signal });
    if (result.data === undefined) throw result.response;
    return mapLiveMapSnapshot(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "The live map could not be loaded.");
  }
}
