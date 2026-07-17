import { View } from "react-native";
import { color } from "@sethu/tokens";

import { Icon, type IconName } from "./Icon";

// The app logo stand-in: a solid-blue rounded square with a glyph. Used on the auth screens (and
// anywhere a brand lockup is needed) until real artwork lands.
export interface BrandMarkProps {
  size?: number;
  icon?: IconName;
}

export function BrandMark({ size = 72, icon = "service" }: BrandMarkProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: color.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} tone="inverse" />
    </View>
  );
}
