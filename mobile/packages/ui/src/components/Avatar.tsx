import { View } from "react-native";

import { Text } from "./Text";

// A circular initials avatar (up to two letters). Used where there is no profile photo — the
// account header, list rows. Falls back to a neutral glyph for an empty name.
export interface AvatarProps {
  name?: string;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name = "", size = 44 }: AvatarProps) {
  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-full bg-primary-container"
    >
      <Text variant="label" tone="primary">
        {initials(name)}
      </Text>
    </View>
  );
}
