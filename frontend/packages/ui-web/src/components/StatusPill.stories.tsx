import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock, ShieldCheck } from "lucide-react";

import { StatusPill } from "./StatusPill";

// The status language of every table and card: tinted background, saturated label, optional 16px
// icon. Countdown semantics: paid=success, due-soon=warning, overdue/critical=danger.
const meta = {
  title: "UI/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  args: { children: "Status" },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone="success">Paid Via Card</StatusPill>
      <StatusPill tone="warning">Due in 10 Days</StatusPill>
      <StatusPill tone="danger">Due in 3 days</StatusPill>
      <StatusPill tone="info">In Progress</StatusPill>
      <StatusPill tone="neutral">Pending</StatusPill>
      <StatusPill tone="brand">Assigned</StatusPill>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone="warning" icon={<Clock />}>
        2 Days left to clear
      </StatusPill>
      <StatusPill tone="success" icon={<ShieldCheck />}>
        Completed (Admin Verified)
      </StatusPill>
    </div>
  ),
};

export const Outlined: Story = {
  args: { tone: "success", outlined: true, children: "Paid Via Cash" },
};

export const Small: Story = { args: { tone: "danger", size: "sm", children: "Expired" } };
