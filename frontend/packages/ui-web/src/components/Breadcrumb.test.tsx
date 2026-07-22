import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./Breadcrumb";

// Stand-in for react-router's Link — proves the `as` seam without a router dependency.
function RouterLink({
  to,
  children,
  ...props
}: { to: string; children: ReactNode } & ComponentProps<"a">) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}

describe("Breadcrumb", () => {
  it("renders a labelled nav landmark with the current page marked", () => {
    render(
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bookings">Bookings</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>BK-2041</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("BK-2041")).toHaveAttribute("aria-current", "page");
  });

  it("renders links through a caller-supplied component via `as`", () => {
    render(
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as={RouterLink} to="/providers">
              Providers
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByRole("link", { name: "Providers" })).toHaveAttribute("href", "/providers");
  });
});
