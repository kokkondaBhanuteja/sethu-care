import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "./Pagination";

// The design paginates by count line plus "Load more", not by numbered pages — page 3 has no meaning
// in a queue an operator scans top-down for the worst problem. The absence of numbered paging is a
// decision, so the count line has to carry the whole "how much am I not seeing" answer by itself.

describe("Pagination", () => {
  it("states how much of the result is on screen", () => {
    render(<Pagination shown={20} total={84} />);

    expect(screen.getByText(/Showing 20 of 84/)).toBeInTheDocument();
  });

  it("appends the subject, so the number is attached to something", () => {
    render(<Pagination shown={20} total={84} subject="active bookings" />);

    expect(screen.getByText(/Showing 20 of 84 active bookings/)).toBeInTheDocument();
  });

  it("announces the count politely as it changes, without stealing focus mid-scan", () => {
    render(<Pagination shown={20} total={84} />);

    expect(screen.getByText(/Showing 20 of 84/)).toHaveAttribute("aria-live", "polite");
  });

  it("offers Load more while rows remain", () => {
    render(<Pagination shown={20} total={84} onLoadMore={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("withholds Load more once everything is shown, so the end of the queue is unambiguous", () => {
    render(<Pagination shown={84} total={84} onLoadMore={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("withholds Load more when the screen cannot load any", () => {
    render(<Pagination shown={20} total={84} />);

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("loads the next page when the operator asks", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(<Pagination shown={20} total={84} onLoadMore={onLoadMore} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("disables and announces busy while the next page is on its way", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(<Pagination shown={20} total={84} onLoadMore={onLoadMore} isLoadingMore />);

    const button = screen.getByRole("button", { name: /Load more/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("handles an empty result without claiming there is more to load", () => {
    render(<Pagination shown={0} total={0} onLoadMore={vi.fn()} />);

    expect(screen.getByText(/Showing 0 of 0/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
