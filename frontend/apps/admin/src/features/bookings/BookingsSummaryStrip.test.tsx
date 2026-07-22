import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BOOKING_SEGMENTS, BOOKING_STATES, UNASSIGNED_FILTER_STATES } from "./bookings.constants";
import { BookingsSummaryStrip } from "./BookingsSummaryStrip";
import type { BookingsSummary } from "./bookings.types";
import type { BookingsListController } from "./useBookingsList";

// The strip carries what the tabs cannot (audit finding: it used to repeat the three tab counts),
// and every tile is a drill-down: clicking applies the narrowing that answers its number.

const SUMMARY: BookingsSummary = {
  escalated: 2,
  oldestUnassignedMinutes: 14,
  completedToday: 30,
};

function listController(): BookingsListController {
  return {
    selectSegment: vi.fn(),
    replaceStates: vi.fn(),
  } as unknown as BookingsListController;
}

function renderStrip(summary: BookingsSummary | undefined = SUMMARY) {
  const list = listController();
  render(<BookingsSummaryStrip summary={summary} list={list} />);
  return list;
}

describe("BookingsSummaryStrip", () => {
  it("renders nothing until the summary arrives", () => {
    const { container } = render(
      <BookingsSummaryStrip summary={undefined} list={listController()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the exception figures, not the tab counts", () => {
    renderStrip();

    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Oldest unassigned")).toBeInTheDocument();
    expect(screen.getByText("14m")).toBeInTheDocument();
    expect(screen.getByText("Completed today")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("filters the queue to escalations from the escalated tile", async () => {
    const stripUser = userEvent.setup();
    const list = renderStrip();

    await stripUser.click(screen.getByRole("button", { name: /Escalated/ }));
    expect(list.selectSegment).toHaveBeenCalledWith(BOOKING_SEGMENTS.active);
    expect(list.replaceStates).toHaveBeenCalledWith([BOOKING_STATES.escalated]);
  });

  it("filters to the waiting states from the oldest-unassigned tile", async () => {
    const stripUser = userEvent.setup();
    const list = renderStrip();

    await stripUser.click(screen.getByRole("button", { name: /Oldest unassigned/ }));
    expect(list.selectSegment).toHaveBeenCalledWith(BOOKING_SEGMENTS.active);
    expect(list.replaceStates).toHaveBeenCalledWith(UNASSIGNED_FILTER_STATES);
  });

  it("opens the completed segment unfiltered from the completed-today tile", async () => {
    const stripUser = userEvent.setup();
    const list = renderStrip();

    await stripUser.click(screen.getByRole("button", { name: /Completed today/ }));
    expect(list.selectSegment).toHaveBeenCalledWith(BOOKING_SEGMENTS.completed);
    expect(list.replaceStates).toHaveBeenCalledWith([]);
  });
});
