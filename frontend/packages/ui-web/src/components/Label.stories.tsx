import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./Input";
import { Label } from "./Label";
import { Textarea } from "./Textarea";

// Always ABOVE the field, muted and medium — the single caption style every form shares.
const meta = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Provider Name" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AboveField: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="provider-name">Provider Name</Label>
      <Input id="provider-name" placeholder="Dr. Ananya Rao" />
    </div>
  ),
};

// peer-disabled needs the label to FOLLOW its `peer` control in the DOM; flex-col-reverse keeps
// the caption visually above while the caption still dims with the disabled field.
export const WithDisabledPeer: Story = {
  render: () => (
    <div className="flex w-72 flex-col-reverse gap-1.5">
      <Textarea id="disabled-field" className="peer" disabled placeholder="Locked" />
      <Label htmlFor="disabled-field">Clinic Notes</Label>
    </div>
  ),
};
