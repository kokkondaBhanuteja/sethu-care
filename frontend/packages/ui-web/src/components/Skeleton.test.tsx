import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton, SkeletonText } from "./Skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive tech — loading is announced by the container, not per block", () => {
    const { container } = render(<Skeleton className="h-4 w-40" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("merges caller classes over the base placeholder styles", () => {
    const { container } = render(<Skeleton className="rounded-full" />);
    expect(container.firstElementChild).toHaveClass("rounded-full");
  });
});

describe("SkeletonText", () => {
  it("renders the requested number of lines", () => {
    const { container } = render(<SkeletonText lines={4} />);
    expect(container.firstElementChild?.children).toHaveLength(4);
  });

  it("defaults to a three-line paragraph", () => {
    const { container } = render(<SkeletonText />);
    expect(container.firstElementChild?.children).toHaveLength(3);
  });
});
