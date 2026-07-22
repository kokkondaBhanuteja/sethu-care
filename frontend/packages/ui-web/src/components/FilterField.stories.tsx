import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { FilterBand, FilterField } from "./FilterField";
import { Input } from "./Input";
import { SearchInput } from "./SearchInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";

// The refs' filter strip recreated: labelled units on a responsive grid, primary action on the
// controls' baseline. Any control drops in as children — the band never knows what it holds.
const meta = {
  title: "UI/FilterBand",
  component: FilterBand,
  tags: ["autodocs"],
} satisfies Meta<typeof FilterBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BookingFilters: Story = {
  render: () => (
    <FilterBand className="w-full" actions={<Button className="w-full sm:w-auto">Show All</Button>}>
      <FilterField label="Search" htmlFor="filter-search">
        <SearchInput id="filter-search" placeholder="Booking ID, name…" clearLabel="Clear search" />
      </FilterField>
      <FilterField label="Service" htmlFor="filter-service">
        <Select>
          <SelectTrigger id="filter-service">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
            <SelectItem value="nursing">Home Nursing</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="From" htmlFor="filter-from">
        <Input id="filter-from" type="date" />
      </FilterField>
      <FilterField label="To" htmlFor="filter-to">
        <Input id="filter-to" type="date" />
      </FilterField>
      <FilterField label="City" htmlFor="filter-city">
        <Input id="filter-city" placeholder="Hyderabad" />
      </FilterField>
    </FilterBand>
  ),
};

export const CustomGrid: Story = {
  render: () => (
    <FilterBand
      className="lg:grid-cols-4 xl:grid-cols-4"
      actions={<Button variant="outline">Apply</Button>}
    >
      <FilterField label="Provider" htmlFor="filter-provider">
        <Input id="filter-provider" placeholder="Any provider" />
      </FilterField>
      <FilterField label="Status" htmlFor="filter-status">
        <Input id="filter-status" placeholder="Any status" />
      </FilterField>
    </FilterBand>
  ),
};
