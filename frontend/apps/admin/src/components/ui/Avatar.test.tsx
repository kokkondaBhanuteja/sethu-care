import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

// Initials are a picture of a name, so they are hidden and the full name is what is announced. The
// derivation only has to survive the names the roster actually holds — which are not all two-word
// Latin ones.

describe("Avatar", () => {
  it("announces the full name, never the initials", () => {
    render(<Avatar name="Suresh Mehta" />);

    expect(screen.getByText("Suresh Mehta")).toHaveClass("sr-only");
    expect(screen.getByText("SM")).toHaveAttribute("aria-hidden");
  });

  it("takes the first and last initial of a two-word name", () => {
    render(<Avatar name="Suresh Mehta" />);

    expect(screen.getByText("SM")).toBeInTheDocument();
  });

  it("takes first and last of a three-word name, not the middle one", () => {
    render(<Avatar name="Ravi Kumar Reddy" />);

    expect(screen.getByText("RR")).toBeInTheDocument();
  });

  it("gives a one-word name a single initial rather than doubling it", () => {
    render(<Avatar name="Ravi" />);

    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("handles a non-Latin name without mangling it — the roster is Telugu and Hindi too", () => {
    render(<Avatar name="रवि कुमार" />);

    expect(screen.getByText("रक")).toBeInTheDocument();
    expect(screen.getByText("रवि कुमार")).toBeInTheDocument();
  });

  it("ignores the extra whitespace a pasted name arrives with", () => {
    render(<Avatar name="  Ajay   Verma  " />);

    expect(screen.getByText("AV")).toBeInTheDocument();
  });

  it("renders an empty monogram rather than throwing on an empty name", () => {
    expect(() => render(<Avatar name="" />)).not.toThrow();
  });

  it("treats a supplied photo as decoration, because the name beside it already identifies the person", () => {
    const { container } = render(
      <Avatar name="Suresh Mehta" imageUrl="https://example.test/suresh.jpg" />,
    );

    // alt="" plus the sr-only name: one announcement, not two.
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.getByText("Suresh Mehta")).toBeInTheDocument();
    expect(screen.queryByText("SM")).not.toBeInTheDocument();
  });

  it("hides the status dot, because the surrounding row states the status in words", () => {
    const { container } = render(<Avatar name="Suresh Mehta" status="suspended" />);

    expect(container.querySelector(".avatar__status")).toHaveAttribute("aria-hidden");
  });

  it("carries its size and brand fill as classes", () => {
    const { container } = render(<Avatar name="Ravi Kumar" size="profile" brand />);

    expect(container.querySelector(".avatar")).toHaveClass("avatar--64", "avatar--brand");
  });
});
