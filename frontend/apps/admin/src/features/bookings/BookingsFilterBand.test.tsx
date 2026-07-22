import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BOOKING_STATES } from "./bookings.constants";
import { BookingsFilterBand, type BookingsFilterBandProps } from "./BookingsFilterBand";

// The desktop filter band: every control sits under a real, programmatically-tied label — the
// caption-above-field grid is only worth having if a screen reader gets the same captions.

function renderBand(overrides?: Partial<BookingsFilterBandProps>) {
  const props: BookingsFilterBandProps = {
    searchTerm: "",
    onSearchChange: vi.fn(),
    availableStates: [BOOKING_STATES.searching, BOOKING_STATES.escalated],
    selectedStates: [],
    onReplaceStates: vi.fn(),
    isFiltered: false,
    onClear: vi.fn(),
    ...overrides,
  };
  render(<BookingsFilterBand {...props} />);
  return props;
}

describe("BookingsFilterBand", () => {
  it("ties its caption to the search field", () => {
    renderBand();

    expect(screen.getByLabelText("Search bookings")).toBeInTheDocument();
  });

  it("ties its caption to the state select", () => {
    renderBand();

    expect(screen.getByLabelText("Booking state")).toBeInTheDocument();
  });

  it("forwards typing to the search handler", async () => {
    const bandUser = userEvent.setup();
    const props = renderBand();

    await bandUser.type(screen.getByLabelText("Search bookings"), "98");
    expect(props.onSearchChange).toHaveBeenCalled();
  });

  it("keeps the reset action inert until something is filtered", () => {
    renderBand();

    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("clears every filter through the reset action", async () => {
    const bandUser = userEvent.setup();
    const props = renderBand({ isFiltered: true });

    await bandUser.click(screen.getByRole("button", { name: "Clear" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
