import { avatarFallbackVariants, cn } from "@sethu/ui-web";

/**
 * Restyled on the @sethu/ui-web avatar language (P3 migration): tinted initials on a pale info
 * fill, brand fill for the signed-in admin. The markup stays app-owned (plain <img>, not Radix)
 * because initials must render deterministically — the sr-only name is the announcement, always.
 * Sizes stay the admin roster's 28–72px ladder, expressed on the rem spacing scale.
 */
export const AVATAR_SIZES = {
  xs: "size-7 text-xs",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
  record: "size-14 text-base",
  profile: "size-16 text-lg",
  hero: "size-18 text-xl",
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export const AVATAR_STATUSES = {
  online: "bg-success-fg",
  busy: "bg-warning-fg",
  offline: "bg-faint",
  suspended: "bg-danger-fg",
} as const;

export type AvatarStatus = keyof typeof AVATAR_STATUSES;

export interface AvatarProps {
  /** Full name. Initials are derived from it, and it becomes the accessible label. */
  name: string;
  size?: AvatarSize;
  imageUrl?: string;
  /** Corner dot. Always paired with the status word in the surrounding row, never colour alone. */
  status?: AvatarStatus;
  /** Brand fill, for the signed-in admin's own avatar. */
  brand?: boolean;
  className?: string;
}

export function Avatar({
  name,
  size = "lg",
  imageUrl,
  status,
  brand = false,
  className,
}: AvatarProps) {
  return (
    <span
      className={cn(
        // "avatar" carries no styling — it is the stable structural hook (tests, debugging).
        "avatar",
        brand ? "bg-primary text-on-primary" : avatarFallbackVariants({ tone: "blue" }),
        // After the variant so tailwind-merge lets the ladder win over the variant's size-full.
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
      {status ? (
        <span
          aria-hidden
          className={cn(
            "avatar__status absolute bottom-0 right-0 block size-2.5 rounded-full ring-2 ring-surface",
            AVATAR_STATUSES[status],
          )}
        />
      ) : null}
    </span>
  );
}

/** First and last initial — "Suresh Mehta" becomes SM. Handles single-word and non-Latin names. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}
