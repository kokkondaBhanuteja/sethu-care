import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditCard, PieChart, TrendingUp, Wallet } from "lucide-react";

import { IconChip } from "./IconChip";
import { KpiTile } from "./KpiTile";
import { StatusPill } from "./StatusPill";

// The Figma #8 dashboard strip: solid chip above a muted caption and a big kpi number, optional
// trend line. Horizontal layout for side panels; onClick turns the tile into a drill-down button.
const meta = {
  title: "UI/KpiTile",
  component: KpiTile,
  tags: ["autodocs"],
  args: {
    label: "Total Amount",
    value: "₹1,28,400",
    icon: <Wallet />,
    accent: "blue",
  },
} satisfies Meta<typeof KpiTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardStrip: Story = {
  render: () => (
    <div className="grid w-3xl max-w-full gap-4 sm:grid-cols-3">
      <KpiTile
        label="Orders"
        value="1,240"
        accent="green"
        icon={<PieChart />}
        delta={
          <span className="flex items-center gap-1 text-success-fg">
            <TrendingUp className="size-4" aria-hidden /> 12% vs last month
          </span>
        }
      />
      <KpiTile label="Total Amount" value="₹1,28,400" accent="blue" icon={<Wallet />} />
      <KpiTile
        label="Pending Dues"
        value="₹21,900"
        accent="red"
        icon={<CreditCard />}
        delta={
          <StatusPill tone="danger" size="sm">
            3 overdue
          </StatusPill>
        }
      />
    </div>
  ),
};

export const Horizontal: Story = {
  args: {
    layout: "horizontal",
    label: "Active Providers",
    value: "86",
    icon: <PieChart />,
    accent: "teal",
  },
  render: (args) => (
    <div className="w-sm max-w-full">
      <KpiTile {...args} />
    </div>
  ),
};

export const Clickable: Story = {
  render: () => (
    <div className="w-sm max-w-full">
      <KpiTile
        label="Returns"
        value="18"
        accent="red"
        icon={<CreditCard />}
        onClick={() => undefined}
      />
    </div>
  ),
};

export const CustomChipSlot: Story = {
  render: () => (
    <div className="w-sm max-w-full">
      <KpiTile
        label="Wallet Balance"
        value="₹4,050"
        chip={
          <IconChip accent="purple" look="soft" size="lg">
            <Wallet />
          </IconChip>
        }
      />
    </div>
  ),
};
