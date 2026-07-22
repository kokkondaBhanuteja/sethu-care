import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "./Label";
import { Textarea } from "./Textarea";

// The multiline field — same fill/invalid vocabulary as Input so mixed forms read seamlessly.
const meta = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { placeholder: "Describe the issue…", className: "w-96 max-w-full" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surface: Story = {};
export const Inset: Story = { args: { fill: "inset" } };
export const Invalid: Story = { args: { invalid: true, defaultValue: "Too short" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Read-only notes" } };

export const LabelledField: Story = {
  render: () => (
    <div className="flex w-96 max-w-full flex-col gap-1.5">
      <Label htmlFor="visit-notes">Visit Notes</Label>
      <Textarea id="visit-notes" rows={5} placeholder="Symptoms, advice, follow-up…" />
    </div>
  ),
};
