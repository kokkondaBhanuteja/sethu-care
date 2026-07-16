import { LinearGradient } from "expo-linear-gradient";
import { color } from "@sethu/tokens";

import { Icon, type IconName } from "./Icon";

// The app logo stand-in: a teal→blue gradient rounded square with a glyph. Used on the auth screens
// (and anywhere a brand lockup is needed) until real artwork lands.
export interface BrandMarkProps {
  size?: number;
  icon?: IconName;
}

export function BrandMark({ size = 72, icon = "service" }: BrandMarkProps) {
  return (
    <LinearGradient
      colors={[color.primary, color.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} tone="inverse" />
    </LinearGradient>
  );
}
