import { createContext, useContext, type ComponentProps } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// Two tab looks from the refs: `segmented` — the Creditors|Debtors pill toggle (inset track,
// active pill lifts onto a white surface) — and `underline` — classic section tabs with the
// primary underline. The look is chosen once on <TabsList> and shared with the triggers through
// context so consumers never have to repeat it per trigger.
export const Tabs = TabsPrimitive.Root;

type TabsLook = "segmented" | "underline";

const TabsLookContext = createContext<TabsLook>("segmented");

const tabsListVariants = cva("", {
  variants: {
    look: {
      segmented: "inline-flex items-center gap-1 rounded-lg bg-inset p-1",
      underline: "flex items-center gap-5 border-b border-border",
    },
  },
  defaultVariants: { look: "segmented" },
});

export interface TabsListProps
  extends ComponentProps<typeof TabsPrimitive.List>, VariantProps<typeof tabsListVariants> {}

export function TabsList({ className, look, ...props }: TabsListProps) {
  return (
    <TabsLookContext.Provider value={look ?? "segmented"}>
      <TabsPrimitive.List className={cn(tabsListVariants({ look }), className)} {...props} />
    </TabsLookContext.Provider>
  );
}

const tabsTriggerVariants = cva(
  "text-sm font-medium text-muted transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none " +
    "disabled:opacity-50",
  {
    variants: {
      look: {
        segmented:
          "rounded-md px-3 py-1.5 data-[state=active]:bg-surface " +
          "data-[state=active]:text-ink data-[state=active]:shadow-card",
        underline:
          "-mb-px border-b-2 border-transparent px-1 py-2.5 " +
          "data-[state=active]:border-primary data-[state=active]:text-ink",
      },
    },
    defaultVariants: { look: "segmented" },
  },
);

export interface TabsTriggerProps
  extends ComponentProps<typeof TabsPrimitive.Trigger>, VariantProps<typeof tabsTriggerVariants> {}

export function TabsTrigger({ className, look, ...props }: TabsTriggerProps) {
  const inheritedLook = useContext(TabsLookContext);
  return (
    <TabsPrimitive.Trigger
      className={cn(tabsTriggerVariants({ look: look ?? inheritedLook }), className)}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export { tabsListVariants, tabsTriggerVariants };
