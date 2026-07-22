import { cx } from "../../lib/cx";

export const AVATAR_SIZES = {
  xs: "avatar--28",
  sm: "avatar--32",
  md: "avatar--36",
  lg: "avatar--40",
  xl: "avatar--48",
  record: "avatar--56",
  profile: "avatar--64",
  hero: "avatar--72",
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export const AVATAR_STATUSES = {
  online: "avatar__status--success",
  busy: "avatar__status--warning",
  offline: "avatar__status--offline",
  suspended: "avatar__status--danger",
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
    <span className={cx("avatar", AVATAR_SIZES[size], brand && "avatar--brand", className)}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full h-full object-cover rounded-full" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
      {status ? (
        <span aria-hidden className={cx("avatar__status", AVATAR_STATUSES[status])} />
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
