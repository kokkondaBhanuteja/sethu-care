import { MemoryRouter } from "react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROUTES } from "../../routes/routes.constants";
import { BookingActionBar } from "./BookingActionBar";
import { BOOKING_ACTION_IDS, type BookingActionSet } from "./useBookingActions";

// The record header's action bar (Figma #7): every visible control is a real button, exactly one
// is filled, and anything beyond the two visible secondaries folds into the overflow menu rather
// than crowding the header. Disabled propagates to everything at once — the stale-record rule.

const BOOKING_ID = "B-8823";

function actionSet(overrides?: Partial<BookingActionSet>): BookingActionSet {
  const assign = { id: BOOKING_ACTION_IDS.assign, to: ROUTES.bookingAssign(BOOKING_ID) };
  const redispatch = {
    id: BOOKING_ACTION_IDS.redispatch,
    to: ROUTES.bookingRedispatch(BOOKING_ID),
  };
  const cancel = { id: BOOKING_ACTION_IDS.cancel, to: ROUTES.bookingCancel(BOOKING_ID) };

  return {
    all: [assign, redispatch, cancel],
    primary: assign,
    secondary: [redispatch, cancel],
    canAcknowledge: false,
    ...overrides,
  };
}

function renderBar(actions: BookingActionSet, isDisabled = false) {
  return render(
    <MemoryRouter>
      <BookingActionBar actions={actions} isDisabled={isDisabled} />
    </MemoryRouter>,
  );
}

describe("BookingActionBar", () => {
  it("renders nothing when the record permits no action", () => {
    const { container } = renderBar(actionSet({ all: [], primary: null, secondary: [] }));

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the secondaries and the one contextual primary as buttons", () => {
    renderBar(actionSet());

    expect(screen.getByRole("button", { name: "Assign provider" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("folds secondaries beyond the visible budget into the overflow menu", () => {
    const refund = { id: BOOKING_ACTION_IDS.refund, to: ROUTES.bookingRefund(BOOKING_ID) };
    const manualComplete = {
      id: BOOKING_ACTION_IDS.manualComplete,
      to: ROUTES.bookingManualComplete(BOOKING_ID),
    };
    const base = actionSet();
    renderBar(
      actionSet({
        all: [...base.all, manualComplete, refund],
        secondary: [...base.secondary, manualComplete, refund],
      }),
    );

    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    // The folded actions are in the closed menu, not competing in the header.
    expect(screen.queryByRole("button", { name: "Issue refund" })).not.toBeInTheDocument();
  });

  it("goes inert as one unit when the record is stale or offline", () => {
    renderBar(actionSet(), true);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const actionButton of buttons) {
      expect(actionButton).toBeDisabled();
    }
  });
});
