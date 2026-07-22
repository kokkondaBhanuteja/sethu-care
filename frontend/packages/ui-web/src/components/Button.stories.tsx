import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Plus, RefreshCw } from "lucide-react";

import { Button } from "./Button";

// Every variant/size on one canvas — the living spec. A new button look must appear here as a
// variant before any screen uses it.
const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Success: Story = { args: { variant: "success", children: "Add Sales" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Suspend" } };
export const Outline: Story = { args: { variant: "outline", children: "View Dashboard" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Clear" } };
export const LinkStyle: Story = { args: { variant: "link", children: "View & Edit" } };

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus /> Add Provider
      </Button>
      <Button variant="outline">
        <Download /> Download as CSV
      </Button>
      <Button variant="ghost" size="icon" aria-label="Refresh">
        <RefreshCw />
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
