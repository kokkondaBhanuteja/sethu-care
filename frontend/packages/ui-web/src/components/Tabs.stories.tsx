import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

// Two looks: `segmented` — the refs' Creditors|Debtors pill toggle on an inset track — and
// `underline` — classic section tabs with the primary underline.
const meta = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Segmented: Story = {
  render: () => (
    <Tabs defaultValue="creditors" className="w-lg max-w-full">
      <TabsList look="segmented">
        <TabsTrigger value="creditors">Creditors</TabsTrigger>
        <TabsTrigger value="debtors">Debtors</TabsTrigger>
      </TabsList>
      <TabsContent value="creditors" className="text-sm text-muted">
        Parties you owe — 12 open invoices.
      </TabsContent>
      <TabsContent value="debtors" className="text-sm text-muted">
        Parties who owe you — 8 open invoices.
      </TabsContent>
    </Tabs>
  ),
};

export const Underline: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-lg max-w-full">
      <TabsList look="underline">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted">
        Account health, balances and recent activity.
      </TabsContent>
      <TabsContent value="transactions" className="text-sm text-muted">
        Every ledger entry for this party.
      </TabsContent>
      <TabsContent value="settings" className="text-sm text-muted">
        Credit limits and notification preferences.
      </TabsContent>
    </Tabs>
  ),
};

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-lg max-w-full">
      <TabsList look="segmented">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="archived" disabled>
          Archived
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="text-sm text-muted">
        Active records only.
      </TabsContent>
    </Tabs>
  ),
};
