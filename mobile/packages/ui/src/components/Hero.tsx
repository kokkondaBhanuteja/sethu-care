import { type ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./Text";

// A full-width solid-blue banner for the top of a screen: an eyebrow line, a headline, and optional
// content underneath (e.g. a search field). Rounds its bottom corners so the page tucks under it.
export interface HeroProps {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}

export function Hero({ title, eyebrow, children }: HeroProps) {
  return (
    <View
      className="bg-primary px-mobile-margin pb-lg pt-md"
      style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
    >
      <View className="gap-1">
        {eyebrow ? (
          <Text variant="label" tone="inverse" className="opacity-90">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="headline" tone="inverse">
          {title}
        </Text>
        {children ? <View className="pt-md">{children}</View> : null}
      </View>
    </View>
  );
}
