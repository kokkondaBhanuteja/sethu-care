import { Pressable, View } from "react-native";

import { Text } from "./Text";

// A star rating on the shared tokens. Interactive by default (tap a star to set the value); pass
// readOnly to display a fixed rating. Filled stars use the primary tone, empty ones muted — colour
// is paired with the ★/☆ glyph so it stays legible without relying on colour alone.
export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  readOnly?: boolean;
  accessibilityLabel?: string;
}

export function Rating({ value, onChange, max = 5, readOnly, accessibilityLabel }: RatingProps) {
  const positions = Array.from({ length: max }, (_unused, index) => index + 1);

  return (
    <View className="flex-row gap-1" accessibilityLabel={accessibilityLabel}>
      {positions.map((position) => {
        const filled = position <= value;
        const glyph = (
          <Text variant="headline" tone={filled ? "primary" : "muted"}>
            {filled ? "★" : "☆"}
          </Text>
        );
        if (readOnly || !onChange) {
          return <View key={position}>{glyph}</View>;
        }
        return (
          <Pressable
            key={position}
            accessibilityRole="button"
            accessibilityLabel={String(position)}
            hitSlop={4}
            onPress={() => onChange(position)}
          >
            {glyph}
          </Pressable>
        );
      })}
    </View>
  );
}
