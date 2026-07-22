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
  },
  defaultVariants: { density: "default" },
});

export interface TableProps
  extends TableHTMLAttributes<HTMLTableElement>, VariantProps<typeof tableVariants> {
  /** Class for the scroll wrapper that keeps wide tables from breaking the page on mobile. */
  wrapperClassName?: string;
}

export function Table({ className, wrapperClassName, density, ...props }: TableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", wrapperClassName)}>
      <table className={cn(tableVariants({ density }), className)} {...props} />
    </div>
  );
}

// `inset` recreates the refs' filled header band; `plain` keeps just the hairline underline.
const tableHeaderVariants = cva("[&_tr]:border-b [&_tr]:border-border", {
  variants: {
    look: { plain: "", inset: "bg-inset" },
  },
  defaultVariants: { look: "plain" },
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
