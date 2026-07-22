import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar, AvatarFallback, AvatarImage, AvatarLabel } from "./Avatar";

// Photo → tinted initials fallback, and the topbar identity block (avatar + name + role).
const meta = {
  title: "UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://i.pravatar.cc/80?img=32" alt="Dr. Ananya Rao" />
      <AvatarFallback tone="green">AR</AvatarFallback>
    </Avatar>
  ),
};

export const InitialsTones: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback tone="amber">BT</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback tone="green">AR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback tone="purple">KK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback tone="blue">LD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback tone="neutral">SB</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback tone="blue">SM</AvatarFallback>
      </Avatar>
      <Avatar size="md">
        <AvatarFallback tone="blue">MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback tone="blue">LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const TopbarIdentity: Story = {
  render: () => (
    <AvatarLabel name="Bhanu Teja" description="Administrator">
      <Avatar>
        <AvatarFallback tone="purple">BT</AvatarFallback>
      </Avatar>
    </AvatarLabel>
  ),
};
