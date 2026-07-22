import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd, KbdGroup } from "./Kbd";

// Keycaps for surfacing shortcuts (sidebar collapse, dialogs' Esc, search focus).
const meta = {
  title: "UI/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "B" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shortcuts: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-sm text-muted">
      <span className="flex items-center gap-2">
        Collapse sidebar
        <KbdGroup aria-label="Command B">
          <Kbd>⌘</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </span>
      <span className="flex items-center gap-2">
        Close dialog <Kbd>Esc</Kbd>
      </span>
    </div>
  ),
};
