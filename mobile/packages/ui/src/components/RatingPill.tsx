import { View } from "react-native";
import { color } from "@sethu/tokens";

import { Text } from "./Text";
import { Icon } from "./Icon";

// The Swiggy/Zomato-style rating chip: a solid green pill with a star + the rating number. Green is
// the universal "good rating" convention, kept only for this data point.
export interface RatingPillProps {
  rating: number;
  count?: string;
  size?: "sm" | "md";
}

export function RatingPill({ rating, count, size = "sm" }: RatingPillProps) {
  return (
    <View className="flex-row items-center gap-1">
      <View
        className="flex-row items-center gap-0.5 rounded-md px-1.5 py-0.5"
        style={{ backgroundColor: color.tertiary }}
      >
        <Icon name="star" size={size === "md" ? 14 : 12} tone="inverse" weight="fill" />
        <Text variant="caption" tone="inverse">
          {rating.toFixed(1)}
        </Text>
      </View>
      {count ? (
        <Text variant="caption" tone="muted">
          {count}
        </Text>
      ) : null}
    </View>
  );
}
