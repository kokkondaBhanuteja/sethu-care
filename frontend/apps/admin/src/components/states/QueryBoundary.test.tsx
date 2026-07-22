import type { UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { EmptyState } from "../ui/EmptyState";
import { QueryBoundary } from "./QueryBoundary";

// Implemented once so the §4.10 states stay consistent across ~40 screens. All five branches are
// asserted here because the two that get skipped in practice — genuinely empty versus empty because
// a filter is hiding forty rows — are the two an operator reads as a broken console.

interface Bookings {
  readonly rows: readonly string[];
}

const SKELETON = <p>Loading bookings</p>;
const EMPTY = <EmptyState icon={Inbox} title="No bookings yet" />;

/** A query result stubbed down to the fields the boundary actually reads. */
function query(partial: Record<string, unknown>): UseQueryResult<Bookings> {
  return { isPending: false, isError: false, ...partial } as unknown as UseQueryResult<Bookings>;
}

function renderBoundary(
  result: UseQueryResult<Bookings>,
  props: Partial<React.ComponentProps<typeof QueryBoundary<Bookings>>> = {},
) {
  return render(
    <QueryBoundary
      query={result}
      skeleton={SKELETON}
      isEmpty={(data) => data.rows.length === 0}
      empty={EMPTY}
      {...props}
    >
      {(data) => <p>{data.rows.join(", ")}</p>}
    </QueryBoundary>,
  );
}

describe("pending", () => {
  it("draws the skeleton on first load, never a spinner standing in for the screen", () => {
    renderBoundary(query({ isPending: true }));

    expect(screen.getByText("Loading bookings")).toBeInTheDocument();
  });
});

describe("error", () => {
  it("renders the failure with copy chosen from the error code", () => {
    renderBoundary(
      query({ isError: true, error: apiError(API_ERROR_CODES.network, "No connection.") }),
    );

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText("No connection.")).toBeInTheDocument();
  });

  it("normalises whatever the query threw, so a raw Error never reaches a screen", () => {
    renderBoundary(query({ isError: true, error: new TypeError("Failed to fetch") }));

    // A bare fetch rejection is a network failure, and the operator is told exactly that.
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it("refetches when the operator takes Retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    renderBoundary(
      query({
        isError: true,
        error: apiError(API_ERROR_CODES.server, "Upstream failed."),
        refetch,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("offers no retry for a failure retrying cannot fix", () => {
    renderBoundary(
      query({ isError: true, error: apiError(API_ERROR_CODES.forbidden, "Not yours.") }),
    );

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});

describe("empty", () => {
  it("shows the genuinely-empty state when nothing is filtering the list", () => {
    renderBoundary(query({ data: { rows: [] } }));

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
  });

  it("renders nothing at all when the screen supplies no empty state", () => {
    const { container } = render(
      <QueryBoundary
        query={query({ data: { rows: [] } })}
        skeleton={SKELETON}
        isEmpty={(data) => data.rows.length === 0}
      >
        {(data) => <p>{data.rows.join(", ")}</p>}
      </QueryBoundary>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("filtered empty", () => {
  it("says the filters are hiding the rows, not that nothing exists", () => {
    // "Nothing here yet" over a list a filter is hiding is how an operator concludes the system is
    // broken and stops trusting the queue.
    renderBoundary(query({ data: { rows: [] } }), { isFiltered: true, onClearFilters: vi.fn() });

    expect(screen.getByText("No results for these filters")).toBeInTheDocument();
    expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();
  });

  it("offers the way out of the filter that caused it", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    renderBoundary(query({ data: { rows: [] } }), { isFiltered: true, onClearFilters });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("falls back to the plain empty state when the screen cannot clear its filters", () => {
    renderBoundary(query({ data: { rows: [] } }), { isFiltered: true });

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
  });
});

describe("data", () => {
  it("hands the data to the caller once there is some", () => {
    renderBoundary(query({ data: { rows: ["#B-8823", "#B-8811"] } }));

    expect(screen.getByText("#B-8823, #B-8811")).toBeInTheDocument();
  });

  it("renders the data when the screen declares no notion of empty", () => {
    render(
      <QueryBoundary query={query({ data: { rows: [] } })} skeleton={SKELETON}>
        {(data) => <p>{data.rows.length} bookings</p>}
      </QueryBoundary>,
    );

    expect(screen.getByText("0 bookings")).toBeInTheDocument();
  });

  it("keeps content on screen during a refetch rather than flashing the skeleton back", () => {
    // isPending is false on a refetch of already-loaded data — the skeleton is a first-load state.
    renderBoundary(query({ data: { rows: ["#B-8823"] }, isFetching: true }));

    expect(screen.getByText("#B-8823")).toBeInTheDocument();
    expect(screen.queryByText("Loading bookings")).not.toBeInTheDocument();
  });
});
