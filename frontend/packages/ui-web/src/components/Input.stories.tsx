import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail, Phone } from "lucide-react";

import { Input } from "./Input";
import { Label } from "./Label";

// Both fills, all sizes, the invalid state and the slots — the whole field vocabulary on one
// canvas. A new field look must appear here as a variant before any screen uses it.
const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Search providers…", className: "w-72" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surface: Story = {};
export const Inset: Story = { args: { fill: "inset" } };
export const Invalid: Story = { args: { invalid: true, defaultValue: "not-an-email" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked value" } };

export const Sizes: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};

export const WithSlots: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <Input leading={<Mail className="text-faint" />} placeholder="Email address" />
      <Input leading={<Phone className="text-faint" />} placeholder="Phone" type="tel" />
      <Input trailing={<span className="text-sm text-faint">kg</span>} placeholder="Weight" />
    </div>
  ),
};

export const LabelledField: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="clinic-email">Clinic Email</Label>
      <Input id="clinic-email" type="email" placeholder="care@clinic.in" />
    </div>
  ),
};
