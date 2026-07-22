import type {
  ComponentPropsWithoutRef,
  ElementType,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight } from "lucide-react";

import { cn } from "../lib/cn";

// The reference table anatomy (Figma #8): uppercase faint header captions, airy white rows split
// by hairline borders, blue link+chevron action cells. Density is set once on <Table> and cascades
// to every cell via descendant selectors so all columns stay in step without per-cell props.
const tableVariants = cva("w-full text-sm", {
  variants: {
    density: {
      default: "[&_td]:py-4 [&_th]:py-3",
      compact: "[&_td]:py-2.5 [&_th]:py-2",
    },
    // `grid` adds hairline column separators (the wide-ledger reference) so many-column rows
    // stay visually aligned; `row` keeps only the horizontal hairlines.
    lines: {
      row: "",
      grid:
        "[&_td:not(:last-child)]:border-r [&_td]:border-border " +
        "[&_th:not(:last-child)]:border-r [&_th]:border-border",
    },
  },
  defaultVariants: { density: "default", lines: "row" },
});

export interface TableProps
  extends TableHTMLAttributes<HTMLTableElement>, VariantProps<typeof tableVariants> {
  /** Class for the scroll wrapper that keeps wide tables from breaking the page on mobile. */
  wrapperClassName?: string;
}

export function Table({ className, wrapperClassName, density, lines, ...props }: TableProps) {
  return (
    <div
      className={cn(
        // Custom slim scrollbar (the reference's rounded dark thumb on a light track) — token
        // colours only, both engines: WebKit pseudo-elements + Firefox scrollbar-* properties.
        "w-full overflow-x-auto pb-1",
        "[scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_var(--color-inset)]",
        "[&::-webkit-scrollbar]:h-1.5",
        "[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-inset",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong",
        "hover:[&::-webkit-scrollbar-thumb]:bg-faint",
        wrapperClassName,
      )}
    >
      <table className={cn(tableVariants({ density, lines }), className)} {...props} />
    </div>
  );
}

// `inset` recreates the refs' filled header band; `plain` keeps just the hairline underline.
// Default look is the reference's filled header band (bg-inset) — it is what makes the header
// row instantly distinguishable from data rows; `plain` opts out for nested/quiet tables.
const tableHeaderVariants = cva("[&_tr]:border-b [&_tr]:border-border", {
  variants: {
    look: { plain: "", inset: "bg-inset" },
  },
  defaultVariants: { look: "inset" },
});

export interface TableHeaderProps
  extends HTMLAttributes<HTMLTableSectionElement>, VariantProps<typeof tableHeaderVariants> {}

export function TableHeader({ className, look, ...props }: TableHeaderProps) {
  return <thead className={cn(tableHeaderVariants({ look }), className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  // Hover lives on the body so header rows never light up; the last row keeps the card edge clean.
  return (
    <tbody
      className={cn("[&_tr:hover]:bg-inset/50 [&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors", className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 text-left align-middle text-table-head font-medium " +
          "uppercase tracking-wider text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 align-middle text-ink", className)} {...props} />;
}

export type TableActionLinkProps<LinkComponent extends ElementType = "a"> = {
  /** The app's router link (react-router `Link`…) — ui-web never imports a router itself. */
  as?: LinkComponent;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<LinkComponent>, "as" | "className" | "children">;

// The refs' action cell: blue medium-weight label + chevron. Generic over `as` so apps get full
// typing for their router's props (`to` etc.) without this package depending on a router.
export function TableActionLink<LinkComponent extends ElementType = "a">({
  as,
  className,
  children,
  ...props
}: TableActionLinkProps<LinkComponent>) {
  const LinkTag: ElementType = as ?? "a";
  return (
    <LinkTag
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-sm font-medium " +
          "text-link hover:underline focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden />
    </LinkTag>
  );
}

export { tableVariants, tableHeaderVariants };
