import { describe, expect, it } from "vitest";

import { fetchAttentionQueueMock } from "./dashboard.mock";
import { ATTENTION_FILTERS } from "./dashboard.types";

// The queue mock reproduces the server's rules (docs/admin-api-contract.md), so its arithmetic is
// contract, not decoration: "Showing 5 of 7" with no way to reach the other two is exactly the bug
// the UX audit found, and every priority must be reachable through a chip.

describe("fetchAttentionQueueMock", () => {
  it("reports a total equal to what an unpaginated fetch returns — no phantom remainder", async () => {
    const queue = await fetchAttentionQueueMock(ATTENTION_FILTERS.all, null);

    expect(queue.total).toBe(queue.items.length);
    expect(queue.counts.all).toBe(queue.items.length);
  });

  it("counts every chip group, so the chip arithmetic is checkable against All", async () => {
    const queue = await fetchAttentionQueueMock(ATTENTION_FILTERS.all, null);

    expect(queue.counts.escalated).toBe(2);
    expect(queue.counts.no_response).toBe(1);
  });

  it("surfaces the no-response record under its own chip, not only under All", async () => {
    const queue = await fetchAttentionQueueMock(ATTENTION_FILTERS.noResponse, null);

    expect(queue.items.map((item) => item.bookingRef)).toEqual(["#B-8830"]);
  });

  it("keeps a paginated page's total at the full queue size so Load more has honest arithmetic", async () => {
    const pageLimit = 2;
    const queue = await fetchAttentionQueueMock(ATTENTION_FILTERS.all, pageLimit);

    expect(queue.items).toHaveLength(pageLimit);
    expect(queue.total).toBe(queue.counts.all);
  });
});
