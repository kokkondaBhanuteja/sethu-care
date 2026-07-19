import { forwardRef, useState } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated from "react-native-reanimated";
import { tv, type VariantProps } from "tailwind-variants";

import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { tapFeedback } from "../lib/haptics";

// Chunky, fully-rounded pill buttons in solid colours (no gradients). Filled variants float on a soft
// coloured shadow; a snappy scale-down on press. Variant-driven, ref-forwarded, accessible, with a
// leading icon (Reanimated CSS transition on an outer wrapper, per Software Mansion's simple-feedback).
const container = tv({
  base: "flex-row items-center justify-center gap-xs rounded-full",
  variants: {
    variant: {
      primary: "bg-primary",
      secondary: "bg-surface-container-lowest border border-outline-variant",
      ghost: "bg-transparent",
      destructive: "bg-error",
    },
    size: {
      sm: "h-11 px-lg",
      md: "h-12 px-xl",
      lg: "h-14 px-xl",
    },
    fullWidth: { true: "w-full" },
    isDisabled: { true: "opacity-50" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

// Soft coloured elevation for the filled variants (kept on the outer wrapper so it isn't clipped).
const SHADOW: Partial<Record<ButtonVariant, string>> = {
  primary: "0 8px 18px rgba(29,78,216,0.30)",
  destructive: "0 8px 18px rgba(220,38,38,0.30)",
};

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
        boxShadow: isDisabled ? undefined : SHADOW[resolvedVariant],
        transform: [{ scale: pressed && !isDisabled ? 0.94 : 1 }],
        transitionProperty: "transform",
        transitionDuration: 110,
        transitionTimingFunction: "ease-out",
      }}
    >
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
        disabled={isDisabled}
        onPress={(event) => {
          tapFeedback();
          onPress?.(event);
        }}
        onPressIn={() => setPressed(true)}
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
