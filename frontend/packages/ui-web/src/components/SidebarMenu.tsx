import type { ComponentPropsWithoutRef, ElementType, HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useSidebar } from "./Sidebar";

// Sidebar composition (shadcn anatomy): Group → small-caps label; Menu (ul) → Item (li) →
// MenuButton — the active-pill nav row from the reference designs (soft tint, saturated label,
// lucide icon). Polymorphic `as` so apps pass their router Link; this package never imports one.

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-2 pb-1 pt-2 text-table-head font-medium uppercase tracking-wider text-faint",
        "group-data-[collapsed]/sidebar:sr-only",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("list-none", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "flex w-full min-h-9 items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "[&_svg]:size-4.5 [&_svg]:shrink-0 " +
    "group-data-[collapsed]/sidebar:justify-center group-data-[collapsed]/sidebar:px-0",
  {
    variants: {
      active: {
        true: "bg-info-bg font-medium text-primary [&_svg]:text-primary",
        false: "text-muted hover:bg-inset hover:text-ink",
      },
      muted: {
        true: "opacity-70",
        false: "",
      },
    },
    defaultVariants: { active: false, muted: false },
  },
);

export type SidebarMenuButtonProps<LinkComponent extends ElementType = "button"> = {
  /** The rendered element — pass your router's Link for navigation items. */
  as?: LinkComponent;
  icon?: ReactNode;
  /** Right-aligned slot (count badge, shortcut hint). Hidden when the rail is collapsed. */
  badge?: ReactNode;
} & VariantProps<typeof sidebarMenuButtonVariants> &
  Omit<ComponentPropsWithoutRef<LinkComponent>, "as">;

export function SidebarMenuButton<LinkComponent extends ElementType = "button">({
  as,
  icon,
  badge,
  active,
  muted,
  className,
  children,
  ...props
}: SidebarMenuButtonProps<LinkComponent>) {
  const Component = (as ?? "button") as ElementType;
  const { open } = useSidebar();
  return (
    <Component
      aria-current={active ? "page" : undefined}
      className={cn(sidebarMenuButtonVariants({ active, muted }), className)}
      {...(Component === "button" ? { type: "button" } : {})}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left group-data-[collapsed]/sidebar:sr-only">
        {children}
      </span>
      {badge && open ? <span className="shrink-0">{badge}</span> : null}
    </Component>
  );
}

export function SidebarSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="separator" className={cn("my-2 border-t border-border", className)} {...props} />
  );
}

export { sidebarMenuButtonVariants };
