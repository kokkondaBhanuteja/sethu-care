import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./Text";

// A screen header: a title (+ optional subtitle) on the left, and an optional action on the right
// (e.g. an icon button or a toggle). Consistent padding/rhythm across every screen.
export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-mobile-margin pb-md pt-sm">
      <View className="flex-1 pr-md">
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" className="mt-1">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}
