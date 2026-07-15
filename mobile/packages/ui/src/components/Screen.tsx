import { forwardRef } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

// A screen container that respects the safe-area insets (notch / Dynamic Island / home indicator)
// and paints the themed background. Content styling goes through className like any View.
export type ScreenProps = ViewProps & {
  edges?: readonly Edge[];
};

export const Screen = forwardRef<View, ScreenProps>(function Screen(
  { edges = ["top", "bottom"], className, children, ...rest },
  ref,
) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1 }}>
      <View ref={ref} className={`flex-1 bg-background ${className ?? ""}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
});
