import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarPlus, SearchX } from "lucide-react";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { IconChip } from "./IconChip";

// The "empty" leg of the four-data-states pattern: soft chip, clear title, short body, one
// obvious next step.
const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: { title: "No results found" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSearchResults: Story = {
  render: () => (
    <EmptyState
      icon={
        <IconChip accent="brand" look="soft" size="lg">
          <SearchX />
        </IconChip>
      }
      title="No results found"
      action={<Button variant="outline">Clear Filters</Button>}
    >
      Nothing matches your search. Try different keywords or clear the active filters.
    </EmptyState>
  ),
};

export const FirstRun: Story = {
  render: () => (
    <EmptyState
      icon={
        <IconChip accent="green" look="soft" size="lg">
          <CalendarPlus />
        </IconChip>
      }
      title="No bookings yet"
      action={<Button variant="success">Create First Booking</Button>}
    >
      When customers book a service it will show up here.
    </EmptyState>
  ),
};

export const TitleOnly: Story = {
  args: { title: "Nothing to show" },
};
