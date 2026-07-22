import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, AvatarFallback, AvatarLabel } from "./Avatar";

describe("Avatar", () => {
  // jsdom never fires image load events, so Radix keeps the fallback — exactly the offline path.
  it("shows tinted initials when no image can load", () => {
    render(
      <Avatar>
        <AvatarFallback tone="green">AR</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("merges caller classes over the size variant", () => {
    const { container } = render(
      <Avatar size="lg" className="ring-2">
        <AvatarFallback>MG</AvatarFallback>
      </Avatar>,
    );
    expect(container.firstElementChild).toHaveClass("ring-2");
  });
});

describe("AvatarLabel", () => {
  it("renders name, description and the avatar children together", () => {
    render(
      <AvatarLabel name="Bhanu Teja" description="Administrator">
        <Avatar>
          <AvatarFallback tone="purple">BT</AvatarFallback>
        </Avatar>
      </AvatarLabel>,
    );
    expect(screen.getByText("Bhanu Teja")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("BT")).toBeInTheDocument();
  });
});
