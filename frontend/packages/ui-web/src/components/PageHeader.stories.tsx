import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download } from "lucide-react";

import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { PageHeader, PageShell } from "./PageHeader";

// The page rhythm: PageShell owns canvas padding + the 24px section gap; PageHeader owns the
// h1 + actions row. Screens compose these — spacing is systemic, not per-screen judgement.
const meta = {
  title: "UI/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { title: "Bookings" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPageRhythm: Story = {
  render: () => (
    <div className="min-h-svh bg-canvas">
      <PageShell>
        <PageHeader
          title="Bookings"
          description="Every booking, searchable and filterable."
          actions={
            <>
              <Button variant="outline" size="sm">
                <Download /> Download CSV
              </Button>
              <Button size="sm">New booking</Button>
            </>
          }
        />
        <Card>
          <CardContent className="pt-5 text-sm text-muted">First section card.</CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm text-muted">
            24px of systemic gap above this one.
          </CardContent>
        </Card>
      </PageShell>
    </div>
  ),
};
