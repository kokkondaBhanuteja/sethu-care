import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from "./Sidebar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./SidebarMenu";

function renderSidebar(defaultOpen = true) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar label="Primary">
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton active>Live</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>Bookings</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarTrigger label="Toggle sidebar" />
    </SidebarProvider>,
  );
}

describe("Sidebar", () => {
  it("renders a labelled nav landmark with menu items", () => {
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookings" })).toBeInTheDocument();
  });

  it("marks the active item as the current page", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Bookings" })).not.toHaveAttribute("aria-current");
  });

  it("collapses to the icon rail via the trigger", async () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).not.toHaveAttribute("data-collapsed");
    await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(nav).toHaveAttribute("data-collapsed");
  });

  it("supports collapsed-by-default via the provider", () => {
    renderSidebar(false);
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute("data-collapsed");
  });
});
