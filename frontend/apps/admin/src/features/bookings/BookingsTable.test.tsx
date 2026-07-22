import { MemoryRouter } from "react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BOOKING_STATES } from "./bookings.constants";
import { BookingsTable } from "./BookingsTable";
import type { BookingListItem } from "./bookings.types";

// The queue's redesigned anatomy: state stays a tinted pill, the state column carries the caret
// filter, and every row ends in the chevron link that commits to the full record — while a row
// click still only selects the preview. Walking the queue and leaving it are different gestures.

const ROWS: readonly BookingListItem[] = [
  {
    id: "B-8823",
    reference: "#B-8823",
    state: BOOKING_STATES.escalated,
    isAdminVerified: false,
    serviceName: "AC repair",
    customerName: "Anita Rao",
    customerPhone: "+919876543210",
    area: "Madhapur",
    slotAt: "2026-07-20T10:30:00+05:30",
    amountPaise: 149_900,
    providerName: null,
    providerNote: { kind: "unassignedFor", minutes: 34 },
  },
  {
    id: "B-8811",
    reference: "#B-8811",
    state: BOOKING_STATES.inProgress,
    isAdminVerified: false,
    serviceName: "Plumbing",
    customerName: "Suresh Mehta",
    customerPhone: "+919812345678",
    area: "Kondapur",
    slotAt: "2026-07-20T11:00:00+05:30",
    amountPaise: 89_900,
    providerName: "Ajay Verma",
    providerNote: { kind: "none" },
  },
];

function renderTable(overrides?: Partial<Parameters<typeof BookingsTable>[0]>) {
  return render(
    <MemoryRouter>
      <BookingsTable rows={ROWS} search="" onSelect={vi.fn()} {...overrides} />
    </MemoryRouter>,
  );
}

describe("BookingsTable", () => {
  it("renders the state as a labelled pill, never colour alone", () => {
    renderTable();

    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("ends every row in a chevron link to the full record", () => {
    renderTable();

    const openLinks = screen.getAllByRole("link", { name: "Open full detail" });
    expect(openLinks).toHaveLength(ROWS.length);
    expect(openLinks[0]).toHaveAttribute("href", "/bookings/B-8823");
  });

  it("adds the phone column only while a search is running", () => {
    renderTable();
    expect(screen.queryByRole("columnheader", { name: "Phone" })).not.toBeInTheDocument();

    renderTable({ search: "98765" });
    expect(screen.getByRole("columnheader", { name: "Phone" })).toBeInTheDocument();
  });

  it("carries the caret filter on the state column when one is wired", () => {
    renderTable({
      stateFilter: {
        available: [BOOKING_STATES.escalated, BOOKING_STATES.inProgress],
        selected: [],
        onChange: vi.fn(),
      },
    });

    expect(screen.getByRole("button", { name: "Booking state" })).toBeInTheDocument();
  });

  it("marks the previewed row as selected for assistive tech", () => {
    renderTable({ selectedId: "B-8811" });

    const selectedRows = screen
      .getAllByRole("row")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
  });
});
