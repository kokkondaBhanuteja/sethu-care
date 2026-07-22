import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The identity mark from the topbar refs: photo when it loads, tinted initials otherwise (Radix
// only swaps to the fallback once the image genuinely fails or is missing). `tone` reuses the
// feature tints so initials always sit on a pale bg with a saturated glyph — never illegible.
const avatarVariants = cva("relative flex shrink-0 overflow-hidden rounded-full", {
  variants: {
    size: {
      sm: "size-8 text-xs",
      md: "size-10 text-sm",
      lg: "size-12 text-base",
    },
  },
  defaultVariants: { size: "md" },
});

const avatarFallbackVariants = cva(
  "flex size-full items-center justify-center rounded-full font-medium",
  {
    variants: {
      tone: {
        amber: "bg-tint-amber-bg text-tint-amber-fg",
        green: "bg-tint-green-bg text-tint-green-fg",
        purple: "bg-tint-purple-bg text-tint-purple-fg",
        blue: "bg-tint-blue-bg text-tint-blue-fg",
        neutral: "bg-neutral-bg text-neutral-fg",
      },
    },
    defaultVariants: { tone: "blue" },
  },
);

export interface AvatarProps
  extends ComponentProps<typeof AvatarPrimitive.Root>, VariantProps<typeof avatarVariants> {}

export function Avatar({ className, size, ...props }: AvatarProps) {
  return <AvatarPrimitive.Root className={cn(avatarVariants({ size }), className)} {...props} />;
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export interface AvatarFallbackProps
  extends
    ComponentProps<typeof AvatarPrimitive.Fallback>,
    VariantProps<typeof avatarFallbackVariants> {}

export function AvatarFallback({ className, tone, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(avatarFallbackVariants({ tone }), className)}
      {...props}
    />
  );
}

export interface AvatarLabelProps extends HTMLAttributes<HTMLDivElement> {
  /** Primary line — the person's name. */
  name: ReactNode;
  /** Secondary line — role, email, clinic… */
  description?: ReactNode;
  nameClassName?: string;
  descriptionClassName?: string;
}

// The topbar identity block: avatar beside a two-line name/role stack. The avatar arrives as
// children so any size/tone (or a custom node) composes without new props here.
export function AvatarLabel({
  name,
  description,
  nameClassName,
  descriptionClassName,
  className,
  children,
  ...props
}: AvatarLabelProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)} {...props}>
      {children}
      <div className="min-w-0">
        <div className={cn("truncate text-sm font-medium text-ink", nameClassName)}>{name}</div>
        {description ? (
          <div className={cn("truncate text-xs text-muted", descriptionClassName)}>
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { avatarVariants, avatarFallbackVariants };
