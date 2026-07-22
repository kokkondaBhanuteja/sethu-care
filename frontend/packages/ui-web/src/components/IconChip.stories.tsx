import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditCard, PieChart, ShoppingCart, Wallet } from "lucide-react";

import { IconChip } from "./IconChip";

// Solid = vivid fill + white glyph (KPI strips); soft = pale tint + saturated glyph (card headers).
const meta = {
  title: "UI/IconChip",
  component: IconChip,
  tags: ["autodocs"],
  args: { children: <Wallet /> },
} satisfies Meta<typeof IconChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconChip accent="green" look="solid" label="Orders">
        <PieChart />
      </IconChip>
      <IconChip accent="red" look="solid" label="Returns">
        <CreditCard />
      </IconChip>
      <IconChip accent="blue" look="solid" label="Amount">
        <Wallet />
      </IconChip>
    </div>
  ),
};

export const Soft: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconChip accent="amber" look="soft" label="Admin">
        <ShoppingCart />
      </IconChip>
      <IconChip accent="green" look="soft" label="Sales">
        <ShoppingCart />
      </IconChip>
      <IconChip accent="purple" look="soft" label="Pharmacy">
        <ShoppingCart />
      </IconChip>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconChip accent="brand" look="soft" size="sm" label="Small">
        <Wallet />
      </IconChip>
      <IconChip accent="brand" look="soft" size="md" label="Medium">
        <Wallet />
      </IconChip>
      <IconChip accent="brand" look="solid" size="lg" label="Large">
        <Wallet />
      </IconChip>
    </div>
  ),
};
