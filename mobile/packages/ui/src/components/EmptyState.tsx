import { View } from "react-native";

import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";

// The "nothing here yet" placeholder for an empty list — an optional icon in a soft circle, a
// title, and a supporting line, centered.
export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
}

export function EmptyState({ title, subtitle, icon }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-2xl">
      {icon ? (
        <View className="mb-xs h-16 w-16 items-center justify-center rounded-full bg-surface-container">
          <Icon name={icon} size={28} tone="muted" />
        </View>
      ) : null}
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" tone="muted" className="text-center">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
