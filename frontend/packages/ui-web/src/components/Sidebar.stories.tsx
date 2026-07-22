import type { Meta, StoryObj } from "@storybook/react-vite";
import { Activity, Bell, ClipboardList, Settings, Users } from "lucide-react";

import { StatusPill } from "./StatusPill";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "./Sidebar";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./SidebarMenu";
import { Avatar, AvatarFallback, AvatarLabel } from "./Avatar";

// The global sidebar: provider-owned state, icon-collapse on desktop (Cmd/Ctrl+B), Sheet drawer on
// mobile. Compose the anatomy — never fork the frame.
const meta = {
  title: "UI/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

function DemoSidebar() {
  return (
    <Sidebar label="Primary">
      <SidebarHeader>
        <span className="text-base font-bold text-primary group-data-[collapsed]/sidebar:sr-only">
          SetuCare
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Live</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton icon={<Activity />} active>
                Live
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                icon={<Bell />}
                badge={
                  <StatusPill tone="danger" size="sm">
                    2
                  </StatusPill>
                }
              >
                Alerts
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton icon={<ClipboardList />}>Bookings</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton icon={<Users />}>Providers</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton icon={<Settings />} muted>
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <AvatarLabel
          name="Ravi Kumar"
          description="Admin"
          className="group-data-[collapsed]/sidebar:justify-center"
          nameClassName="group-data-[collapsed]/sidebar:sr-only"
          descriptionClassName="group-data-[collapsed]/sidebar:sr-only"
        >
          <Avatar size="sm">
            <AvatarFallback tone="green">RK</AvatarFallback>
          </Avatar>
        </AvatarLabel>
      </SidebarFooter>
    </Sidebar>
  );
}

export const Default: Story = {
  args: { label: "Primary" },
  render: () => (
    <SidebarProvider>
      <div className="flex h-svh bg-canvas">
        <DemoSidebar />
        <main className="flex-1 p-6">
          <SidebarTrigger label="Toggle sidebar" />
          <p className="mt-4 text-sm text-muted">Cmd/Ctrl+B collapses the rail to icons.</p>
        </main>
      </div>
    </SidebarProvider>
  ),
};

export const CollapsedByDefault: Story = {
  args: { label: "Primary" },
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-svh bg-canvas">
        <DemoSidebar />
        <main className="flex-1 p-6">
          <SidebarTrigger label="Toggle sidebar" />
        </main>
      </div>
    </SidebarProvider>
  ),
};
