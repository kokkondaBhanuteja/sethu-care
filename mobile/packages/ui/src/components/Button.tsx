import { forwardRef, useState } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated from "react-native-reanimated";
import { tv, type VariantProps } from "tailwind-variants";

import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { tapFeedback } from "../lib/haptics";

// Pill buttons in solid colours (no gradients). Primary is solid blue; the others are outline/ghost/
// destructive. Variant-driven, ref-forwarded, accessible, with a leading icon and an HIG-style press
// depress (Reanimated CSS transition on an outer wrapper, per Software Mansion's simple-feedback pattern).
const container = tv({
  base: "flex-row items-center justify-center gap-xs rounded-full overflow-hidden",
  variants: {
    variant: {
      primary: "bg-primary",
      secondary: "bg-surface-container-lowest border border-outline-variant",
      ghost: "bg-transparent",
      destructive: "bg-error",
    },
    size: {
      sm: "h-10 px-md",
      md: "h-12 px-lg",
      lg: "h-14 px-xl",
    },
    fullWidth: { true: "w-full" },
    isDisabled: { true: "opacity-50" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const labelTone: Record<ButtonVariant, "inverse" | "default" | "primary"> = {
  primary: "inverse",
  secondary: "default",
  ghost: "primary",
  destructive: "inverse",
};

const iconTone: Record<ButtonVariant, "inverse" | "default" | "primary"> = labelTone;

export type ButtonProps = Omit<VariantProps<typeof container>, "isDisabled"> & {
  label: string;
  icon?: IconName;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    label,
    icon,
    variant = "primary",
    size = "md",
    fullWidth,
    disabled,
    loading,
    onPress,
    accessibilityLabel,
  },
  ref,
) {
  const isDisabled = Boolean(disabled) || Boolean(loading);
  const resolvedVariant = variant ?? "primary";
  const [pressed, setPressed] = useState(false);

  return (
    <Animated.View
      style={{
        alignSelf: fullWidth ? "stretch" : "flex-start",
        transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        transitionProperty: "transform",
        transitionDuration: 120,
        transitionTimingFunction: "ease-out",
      }}
    >
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => {
          setPressed(true);
          tapFeedback();
        }}
        onPressOut={() => setPressed(false)}
        className={container({ variant, size, fullWidth, isDisabled })}
      >
        {icon && !loading ? <Icon name={icon} size={18} tone={iconTone[resolvedVariant]} /> : null}
        <Text variant="label" tone={labelTone[resolvedVariant]}>
          {loading ? "…" : label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
