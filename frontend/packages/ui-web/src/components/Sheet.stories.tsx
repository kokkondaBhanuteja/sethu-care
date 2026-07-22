import type { Meta, StoryObj } from "@storybook/react-vite";
import { Filter } from "lucide-react";

import { Button } from "./Button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./Sheet";
import { StatusPill } from "./StatusPill";

// Side drawers: `right` for desktop detail panels, `bottom` (rounded top) for mobile filter
// sheets — same Header/Footer anatomy as Dialog.
const meta = {
  title: "UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RightDetailPanel: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">View Booking</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Booking #B-1042</SheetTitle>
          <SheetDescription>Home nursing visit — Anitha Home Care</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          Status <StatusPill tone="info">In Progress</StatusPill>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button>Reassign</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const BottomFilterSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter /> Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Filter bookings</SheetTitle>
          <SheetDescription>Narrow the list by status and date range.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill tone="success">Completed</StatusPill>
          <StatusPill tone="warning">Pending</StatusPill>
          <StatusPill tone="danger">Overdue</StatusPill>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="ghost">Clear</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Apply Filters</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const LeftPanel: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
