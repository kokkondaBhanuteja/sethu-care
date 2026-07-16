import { type ReactNode } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { color } from "@sethu/tokens";

import { Text } from "./Text";

// A full-width teal→blue gradient banner for the top of a screen: an eyebrow line, a headline, and
// optional content underneath (e.g. a search field). Rounds its bottom corners so the page content
// tucks under it.
export interface HeroProps {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}

export function Hero({ title, eyebrow, children }: HeroProps) {
  return (
    <LinearGradient
      colors={[color.primary, color.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
    >
      <View className="gap-1 px-mobile-margin pb-lg pt-md">
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
    </LinearGradient>
  );
}
