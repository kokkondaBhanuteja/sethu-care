import { View } from "react-native";

import { Text } from "./Text";

// The "nothing here yet" placeholder for an empty list. Title + optional supporting line, centered.
export interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-1 py-2xl">
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
