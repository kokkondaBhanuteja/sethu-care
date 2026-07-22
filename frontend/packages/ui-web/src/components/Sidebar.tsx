import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { PanelLeft } from "lucide-react";

import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./Button";
import { Sheet, SheetContent } from "./Sheet";

// The global sidebar frame (shadcn Sidebar anatomy): a Provider owning open state, a fixed rail on
// desktop that collapses to icons, and a Sheet drawer on mobile — one component, every app.
// Composition lives in SidebarMenu.tsx (groups, items, badges). Fully controllable: open/onOpenChange
// for controlled use, defaultOpen otherwise; Cmd/Ctrl+B toggles (listener cleaned up on unmount).

interface SidebarContextValue {
  open: boolean;
  isMobile: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return context;
}

export interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Viewport width (px) below which the sidebar becomes a Sheet drawer. */
  mobileBreakpoint?: number;
  children: ReactNode;
}

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  mobileBreakpoint = 768,
  children,
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setUncontrolledOpen(next);
    },
    [controlledOpen, onOpenChange],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    // Guarded: jsdom (tests) and SSR passes have no matchMedia — desktop is the safe default.
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mobileBreakpoint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ open, isMobile, toggle, setOpen }),
    [open, isMobile, toggle, setOpen],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name for the nav landmark (apps localize). */
  label: string;
  /** Desktop collapse behaviour: shrink to an icon rail, or none (always full width). */
  collapsible?: "icon" | "none";
}

export function Sidebar({
  label,
  collapsible = "icon",
  className,
  children,
  ...props
}: SidebarProps) {
  const { open, isMobile, setOpen } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0" aria-label={label}>
          <nav aria-label={label} className="flex h-full flex-col gap-1 p-3">
            {children}
          </nav>
        </SheetContent>
      </Sheet>
    );
  }

  const collapsed = collapsible === "icon" && !open;
  return (
    <nav
      aria-label={label}
      data-collapsed={collapsed || undefined}
      className={cn(
        "group/sidebar flex h-full shrink-0 flex-col gap-1 border-r border-border bg-surface p-3",
        "transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

export function SidebarTrigger({
  className,
  ...props
}: Omit<ButtonProps, "children"> & { label: string }) {
  const { toggle } = useSidebar();
  const { label, ...rest } = props as ButtonProps & { label: string };
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={toggle}
      className={cn("text-muted", className)}
      {...rest}
    >
      <PanelLeft />
    </Button>
  );
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 px-2 py-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto", className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto border-t border-border px-2 pt-3", className)} {...props} />;
}
