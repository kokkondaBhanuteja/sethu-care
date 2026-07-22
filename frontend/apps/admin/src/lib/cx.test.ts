import { describe, expect, it } from "vitest";

import { cx } from "./cx";

// Every conditional class in the design system goes through here: `cond && "is-selected"`. The only
// property that matters is that a falsy branch contributes nothing at all — a stray "false" or
// "undefined" in a class attribute is invisible in review and impossible to spot in the DOM.

describe("cx", () => {
  it("joins the truthy names with a single space", () => {
    expect(cx("btn", "btn--primary", "btn--48")).toBe("btn btn--primary btn--48");
  });

  it.each([
    ["false", false],
    ["null", null],
    ["undefined", undefined],
    ["the empty string", ""],
  ])("drops %s, so an unmet condition never lands in the class attribute", (_name, value) => {
    expect(cx("btn", value, "btn--block")).toBe("btn btn--block");
  });

  it("returns an empty string when nothing survives, never a stray space", () => {
    expect(cx()).toBe("");
    expect(cx(false, null, undefined)).toBe("");
  });

  it("preserves order, because the component layer relies on later modifiers winning", () => {
    expect(cx("pill", "pill--danger", "pill--on-tint")).toBe("pill pill--danger pill--on-tint");
  });
});
