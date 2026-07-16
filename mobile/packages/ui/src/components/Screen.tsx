import { forwardRef } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { color } from "@sethu/tokens";

// A screen container that respects the safe-area insets (notch / Dynamic Island / home indicator)
// and paints the themed background. The background is set on the SafeAreaView too, so the inset
// strips (status bar / home indicator) match the page instead of showing the system grey.
export type ScreenProps = ViewProps & {
  edges?: readonly Edge[];
};

export const Screen = forwardRef<View, ScreenProps>(function Screen(
  { edges = ["top", "bottom"], className, children, ...rest },
  ref,
) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color.background }}>
      <View ref={ref} className={`flex-1 bg-background ${className ?? ""}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
});
