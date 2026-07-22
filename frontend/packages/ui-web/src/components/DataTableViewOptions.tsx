import { Settings2 } from "lucide-react";

import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import type { DataTableColumn } from "./DataTable";

// The "Columns" view menu that pairs with <DataTable>: toggle visibility per hideable column.
// Controlled: the caller owns hiddenColumns state and passes it to both components.
export interface DataTableViewOptionsProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  hiddenColumns: readonly string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  /** Trigger text, e.g. "Columns" (apps localize). */
  label: string;
  menuLabel?: string;
}

export function DataTableViewOptions<TRow>({
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
  label,
  menuLabel,
}: DataTableViewOptionsProps<TRow>) {
  const hideable = columns.filter((column) => column.hideable !== false);

  const toggle = (columnId: string) => {
    onHiddenColumnsChange(
      hiddenColumns.includes(columnId)
        ? hiddenColumns.filter((existing) => existing !== columnId)
        : [...hiddenColumns, columnId],
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuLabel ? <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel> : null}
        {hideable.map((column) => {
          const isVisible = !hiddenColumns.includes(column.id);
          return (
            <DropdownMenuItem
              key={column.id}
              onSelect={(event) => {
                event.preventDefault(); // keep the menu open while toggling several columns
                toggle(column.id);
              }}
              aria-checked={isVisible}
              role="menuitemcheckbox"
            >
              <Check className={cn("size-4 text-primary", !isVisible && "invisible")} aria-hidden />
              {column.header}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
