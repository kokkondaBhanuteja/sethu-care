import { forwardRef, useState, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated from "react-native-reanimated";

import { selectFeedback } from "../lib/haptics";

// Tap feedback for cards and rows. Follows Software Mansion's guidance for simple press/release
// feedback: a Reanimated CSS transition driven by Pressable + React state — no shared values or
// worklet bridging. The Animated.View carries only the transform, so NativeWind styling stays on the
// child (the Card). Gives every tappable surface the subtle depress the HIG expects.
export interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  scaleTo?: number;
}

export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { children, scaleTo = 0.97, accessibilityRole = "button", onPressIn, onPressOut, ...rest },
  ref,
) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      onPressIn={(event) => {
        setPressed(true);
        selectFeedback();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View
        style={{
          transform: [{ scale: pressed ? scaleTo : 1 }],
          opacity: pressed ? 0.96 : 1,
          transitionProperty: ["transform", "opacity"],
          transitionDuration: 130,
          transitionTimingFunction: "ease-out",
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
});
