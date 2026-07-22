import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination, type PaginationLabels } from "./Pagination";

const paginationLabels: PaginationLabels = {
  first: "First page",
  previous: "Previous page",
  next: "Next page",
  last: "Last page",
  page: (pageNumber) => `Page ${pageNumber}`,
};

// Queries are scoped to each render's container — several pagers share label text across tests.
function renderPager(page: number, onPageChange: (nextPage: number) => void) {
  const renderResult = render(
    <Pagination
      aria-label="Pagination"
      page={page}
      pageCount={12}
      onPageChange={onPageChange}
      labels={paginationLabels}
      summary={`Page ${page} of 12`}
    />,
  );
  return within(renderResult.container);
}

describe("Pagination", () => {
  it("steps and jumps through every control", async () => {
    const onPageChange = vi.fn();
    const pager = renderPager(3, onPageChange);
    await userEvent.click(pager.getByRole("button", { name: "Previous page" }));
    await userEvent.click(pager.getByRole("button", { name: "Next page" }));
    await userEvent.click(pager.getByRole("button", { name: "First page" }));
    await userEvent.click(pager.getByRole("button", { name: "Last page" }));
    await userEvent.click(pager.getByRole("button", { name: "Page 5" }));
    expect(onPageChange.mock.calls.map(([nextPage]) => nextPage)).toEqual([2, 4, 1, 12, 5]);
  });

  it("marks the current page for assistive tech", () => {
    const pager = renderPager(3, () => undefined);
    expect(pager.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
  });

  it("disables backward controls on the first page and forward on the last", () => {
    const pager = renderPager(1, () => undefined);
    expect(pager.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(pager.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(pager.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("shows the caller's localized summary", () => {
    const pager = renderPager(3, () => undefined);
    expect(pager.getByText("Page 3 of 12")).toBeInTheDocument();
  });
});
