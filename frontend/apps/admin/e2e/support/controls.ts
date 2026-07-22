import { expect, type Locator } from "@playwright/test";

/**
 * Choose an option inside one of the console's labelled radio groups.
 *
 * `components/ui/form/RadioGroup.tsx` renders a real native `<input type="radio">` marked `sr-only`
 * and paints the control with a sibling span — the correct pattern, and the reason the group has
 * arrow-key navigation and a single tab stop for free. It also means the input is a 1x1 clipped
 * box, so a pointer hit-test can never land on it. Selecting with the keyboard is both what the
 * design intends and the only interaction that does not need a `force` escape hatch.
 *
 * `optionLabel` matches the START of the option's accessible name, because options carry their
 * consequence in the same label ("Goodwill credit Instant Credit beyond the booking value").
 */
export async function chooseOption(group: Locator, optionLabel: string): Promise<void> {
  const option = optionIn(group, optionLabel);
  await option.press(" ");
  await expect(option).toBeChecked();
}

export function optionIn(group: Locator, optionLabel: string): Locator {
  return group.getByRole("radio", { name: startsWith(optionLabel) });
}

/** `components/ui/form/Checkbox.tsx` hides its native input the same way — same reasoning. */
export async function tick(checkbox: Locator): Promise<void> {
  await checkbox.press(" ");
  await expect(checkbox).toBeChecked();
}

function startsWith(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}
