import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Combobox, type ComboboxOption } from "./Combobox";

// The searchable dropdown: filter box + keyboard-navigable list. Options are data; rendering,
// filtering and the trigger are all overridable.
const PROVIDERS: ComboboxOption[] = [
  { value: "prv_1", label: "Suresh Mehta" },
  { value: "prv_2", label: "Kiran Rao" },
  { value: "prv_3", label: "Ajay Verma" },
  { value: "prv_4", label: "Anita Sharma", disabled: true },
];

const meta = {
  title: "UI/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: {
    options: PROVIDERS,
    value: null,
    onChange: () => undefined,
    placeholder: "Select a provider",
    searchPlaceholder: "Search providers…",
    emptyText: "No provider matches",
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledCombobox() {
  const [value, setValue] = useState<string | null>("prv_2");
  return (
    <div className="w-72">
      <Combobox
        options={PROVIDERS}
        value={value}
        onChange={setValue}
        placeholder="Select a provider"
        searchPlaceholder="Search providers…"
        emptyText="No provider matches"
      />
    </div>
  );
}

export const Default: Story = { render: () => <ControlledCombobox /> };
