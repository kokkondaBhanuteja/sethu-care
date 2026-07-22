import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchInput } from "./SearchInput";

// Magnifier + conditional clear. The controlled story is the intended usage: the caller owns the
// value and the clear button hands control back via onClear.
const meta = {
  title: "UI/SearchInput",
  component: SearchInput,
  tags: ["autodocs"],
  args: { placeholder: "Search bookings…", clearLabel: "Clear search", className: "w-72" },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hooks are not allowed directly in a render function — a tiny host component owns the state.
function ControlledSearchExample() {
  const [query, setQuery] = useState("Dr. Ananya");
  return (
    <SearchInput
      className="w-72"
      placeholder="Search bookings…"
      clearLabel="Clear search"
      value={query}
      onChange={(changeEvent) => setQuery(changeEvent.target.value)}
      onClear={() => setQuery("")}
    />
  );
}

export const Empty: Story = { args: { value: "", onChange: () => undefined } };

export const Controlled: Story = { render: () => <ControlledSearchExample /> };

export const Inset: Story = {
  args: { fill: "inset", value: "paracetamol", onChange: () => undefined },
};
