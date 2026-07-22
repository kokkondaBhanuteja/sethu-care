import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card, CardContent, CardHeader } from "./Card";
import { Skeleton, SkeletonText } from "./Skeleton";

// Pulsing inset placeholders — shape via className; SkeletonText fakes a paragraph.
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const Circle: Story = { args: { className: "size-10 rounded-full" } };
export const Block: Story = { args: { className: "h-24 w-64 rounded-lg" } };

export const Paragraph: Story = {
  render: () => <SkeletonText className="w-72" lines={4} />,
};

export const CardLoading: Story = {
  render: () => (
    <Card className="w-96 max-w-full">
      <CardHeader icon={<Skeleton className="size-10 rounded-lg" />}>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <SkeletonText lines={3} />
      </CardContent>
    </Card>
  ),
};
