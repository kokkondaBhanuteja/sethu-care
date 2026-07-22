import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { ToastProvider, ToastViewport, useToast, type ToastTone } from "./Toast";

// The app shell mounts <ToastProvider> + one <ToastViewport>; features fire via useToast().
// Tones reuse the StatusPill tint pairs so status language stays consistent.
const meta = {
  title: "UI/Toast",
  component: ToastViewport,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <ToastViewport />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ToastViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

const DEMO_TOASTS: ReadonlyArray<{ tone: ToastTone; title: string; description?: string }> = [
  {
    tone: "success",
    title: "Invoice saved",
    description: "INV-2041 is on its way to the customer.",
  },
  {
    tone: "danger",
    title: "Payment failed",
    description: "The card was declined. Try another method.",
  },
  { tone: "info", title: "Sync in progress", description: "New bookings will appear shortly." },
  { tone: "neutral", title: "Draft stored" },
];

function ToastDemoButtons() {
  const { showToast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      {DEMO_TOASTS.map((demoToast) => (
        <Button key={demoToast.tone} variant="outline" onClick={() => showToast(demoToast)}>
          Show {demoToast.tone}
        </Button>
      ))}
    </div>
  );
}

export const Tones: Story = {
  render: () => <ToastDemoButtons />,
};

function PersistentToastButton() {
  const { showToast } = useToast();
  return (
    <Button
      variant="outline"
      onClick={() =>
        showToast({
          tone: "info",
          title: "Sticky toast",
          description: "durationMs: 0 keeps it until dismissed.",
          durationMs: 0,
        })
      }
    >
      Show persistent toast
    </Button>
  );
}

export const Persistent: Story = {
  render: () => <PersistentToastButton />,
};
