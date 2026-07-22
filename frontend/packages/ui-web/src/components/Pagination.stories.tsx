import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card, CardContent, CardFooter } from "./Card";
import { Pagination, type PaginationLabels } from "./Pagination";

// The card-footer pager. Storybook passes English labels; apps pass localized ones — the
// component itself ships no text.
const paginationLabels: PaginationLabels = {
  first: "First page",
  previous: "Previous page",
  next: "Next page",
  last: "Last page",
  page: (pageNumber) => `Page ${pageNumber}`,
};

const meta = {
  title: "UI/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  args: {
    "aria-label": "Pagination",
    page: 3,
    pageCount: 12,
    labels: paginationLabels,
    summary: "Page 3 of 12",
    onPageChange: () => undefined,
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hooks are not allowed directly in a render function — a tiny host component owns the state.
function ControlledPagerExample({ className }: { className?: string }) {
  const [page, setPage] = useState(1);
  const pageCount = 12;
  return (
    <Pagination
      aria-label="Pagination"
      className={className}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      labels={paginationLabels}
      summary={`Page ${page} of ${pageCount}`}
    />
  );
}

export const Default: Story = {};

export const Controlled: Story = { render: () => <ControlledPagerExample /> };

export const FewPages: Story = { args: { page: 1, pageCount: 3, summary: "Page 1 of 3" } };

export const InCardFooter: Story = {
  render: () => (
    <Card className="w-[36rem] max-w-full">
      <CardContent className="pt-4 text-sm text-muted sm:pt-5">Table rows render here.</CardContent>
      <CardFooter>
        <ControlledPagerExample className="w-full" />
      </CardFooter>
    </Card>
  ),
};
