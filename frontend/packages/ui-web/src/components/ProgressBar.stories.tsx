import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProgressBar } from "./ProgressBar";

// Stock-level bars from the reference tables: vivid fill, rounded track, optional % label.
const meta = {
  title: "UI/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  args: { value: 50, label: "Stock level" },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const stockTone = (value: number) => (value < 60 ? "danger" : value < 90 ? "warning" : "success");

export const Tones: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <ProgressBar value={50} label="Stock level" toneFor={stockTone} showValue />
      <ProgressBar value={88} label="Stock level" toneFor={stockTone} showValue />
      <ProgressBar value={95} label="Stock level" toneFor={stockTone} showValue />
    </div>
  ),
};
