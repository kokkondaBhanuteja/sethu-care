import { StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

// The design's signature "Soft Glassmorphism", correct per platform: real Apple Liquid Glass on
// iOS 26 (expo-glass-effect), an expo-blur frosted fallback everywhere else. Per Apple's HIG, use
// this ONLY on the floating navigation layer (tab bar, sheets, headers, floating controls) — never
// behind primary content. Styling (rounding, size) goes on the wrapper via className.
export type GlassSurfaceProps = ViewProps & {
  intensity?: number;
  tint?: "light" | "dark" | "default";
};

export function GlassSurface({ intensity = 40, tint = "default", className, children, ...rest }: GlassSurfaceProps) {
  return (
    <View className={`overflow-hidden ${className ?? ""}`} {...rest}>
      {isLiquidGlassAvailable() ? (
        <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
      ) : (
        <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}
