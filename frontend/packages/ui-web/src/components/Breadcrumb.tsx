import type { ComponentProps, ElementType, HTMLAttributes, LiHTMLAttributes } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "../lib/cn";

// The trail above every detail screen: muted links, ink current page, chevron separators.
// BreadcrumbLink is polymorphic (`as`) so apps hand it react-router's Link — this package must
// never depend on a router. The nav's aria-label is a required prop: landmarks need names and
// localisation lives in the apps.
export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name for the nav landmark — caller localizes (e.g. "Breadcrumb"). */
  "aria-label": string;
}

export function Breadcrumb({ className, ...props }: BreadcrumbProps) {
  return <nav className={cn("text-sm", className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5 text-muted sm:gap-2", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

export type BreadcrumbLinkProps<LinkComponent extends ElementType = "a"> = {
  /** Rendered element/component — pass react-router's Link (with `to`) in the apps. */
  as?: LinkComponent;
  className?: string;
} & Omit<ComponentProps<LinkComponent>, "as" | "className">;

export function BreadcrumbLink<LinkComponent extends ElementType = "a">({
  as: linkAs,
  className,
  ...props
}: BreadcrumbLinkProps<LinkComponent>) {
  const LinkElement: ElementType = linkAs ?? "a";
  return (
    <LinkElement
      className={cn(
        "rounded-sm transition-colors hover:text-ink focus-visible:outline-none " +
          "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cn("font-medium text-ink", className)} {...props} />;
}

export function BreadcrumbSeparator({
  className,
  children,
  ...props
}: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      role="presentation"
      aria-hidden
      className={cn("text-faint [&_svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}
