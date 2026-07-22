import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartColumn, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "./Button";
import { Card, CardContent, CardFooter, CardHeader } from "./Card";
import { IconChip } from "./IconChip";

// The card anatomy every screen composes: header (icon chip + title + per-card actions),
// content, optional footer. Tinted tones recreate the reference's feature cards.
const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHeaderActions: Story = {
  render: () => (
    <Card className="w-[36rem] max-w-full">
      <CardHeader
        icon={
          <IconChip accent="amber" look="soft">
            <TriangleAlert />
          </IconChip>
        }
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Button variant="outline" size="sm">
              View Report
            </Button>
          </>
        }
      >
        Expiry Alert
      </CardHeader>
      <CardContent className="text-sm text-muted">
        Card content composes tables, charts and lists here.
      </CardContent>
      <CardFooter className="text-xs text-faint">Page 1 of 3</CardFooter>
    </Card>
  ),
};

export const FeatureTints: Story = {
  render: () => (
    <div className="grid w-[52rem] max-w-full gap-4 sm:grid-cols-3">
      {(
        [
          ["amber", "Bookings"],
          ["green", "Providers"],
          ["purple", "Payments"],
        ] as const
      ).map(([tone, title]) => (
        <Card key={tone} tone={tone}>
          <CardHeader
            icon={
              <IconChip
                accent={tone === "amber" ? "amber" : tone === "green" ? "green" : "purple"}
                look="solid"
              >
                <ChartColumn />
              </IconChip>
            }
          >
            {title}
          </CardHeader>
          <CardContent className="text-sm text-muted">
            View comprehensive analytics and key metrics.
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
