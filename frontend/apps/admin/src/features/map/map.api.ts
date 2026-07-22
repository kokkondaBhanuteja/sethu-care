import { normalizeError } from "../../lib/http/apiError";
import { fetchLiveMapSnapshotMock } from "./map.mock";
import type { LiveMapSnapshot } from "./map.types";

// The one boundary between the map and its data.
//
// `GET /ops/live-map` does not exist yet — see docs/admin-api-contract.md. When it lands, the
// generated client's call replaces the mock call below and no component changes. The same is true
// of the surface itself: this file returns percentage positions, so a tile layer only changes how
// MapSurface projects them.

export async function fetchLiveMapSnapshot(signal?: AbortSignal): Promise<LiveMapSnapshot> {
  try {
    return await fetchLiveMapSnapshotMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The live map could not be loaded.");
  }
}
