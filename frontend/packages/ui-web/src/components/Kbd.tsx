import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

// Keyboard-shortcut caps (the shadcn Kbd anatomy): a real <kbd> element styled as a small keycap —
// inset fill, hairline border with a bottom edge, tabular text. Group several with <KbdGroup>.
// Purely presentational; the shortcut itself is wired wherever the behaviour lives.
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border",
        "border-b-2 bg-inset px-1 font-sans text-[11px] font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center gap-1", className)} {...props} />;
}
