import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Select";

// The dropdown field: trigger wears the Input silhouette, options float on the overlay shadow
// with a check on the chosen row.
const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="physiotherapy">
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
        <SelectItem value="nursing">Home Nursing</SelectItem>
        <SelectItem value="lab">Lab Collection</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const FillsAndSizes: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Select>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Small · surface" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger fill="inset">
          <SelectValue placeholder="Medium · inset" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">This Week</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger size="lg" invalid>
          <SelectValue placeholder="Large · invalid" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">This Month</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const GroupedOptions: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Assign a provider" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Physiotherapy</SelectLabel>
          <SelectItem value="ananya">Dr. Ananya Rao</SelectItem>
          <SelectItem value="kiran">Dr. Kiran Kumar</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Nursing</SelectLabel>
          <SelectItem value="lakshmi">Lakshmi Devi</SelectItem>
          <SelectItem value="suresh" disabled>
            Suresh Babu (on leave)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
