import { forwardRef } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tv, type VariantProps } from "tailwind-variants";
import { color } from "@sethu/tokens";

import { Text } from "./Text";

// Pill buttons matching the design. The primary variant is the Indigo→Violet gradient CTA; the
// others are solid/glass. Variant-driven, ref-forwarded, and accessible by default.
const container = tv({
  base: "flex-row items-center justify-center rounded-full overflow-hidden",
  variants: {
    variant: {
      primary: "",
      secondary: "bg-surface-container border border-outline-variant",
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

export type ButtonProps = Omit<VariantProps<typeof container>, "isDisabled"> & {
  label: string;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  { label, variant = "primary", size = "md", fullWidth, disabled, loading, onPress, accessibilityLabel },
  ref,
) {
  const isDisabled = Boolean(disabled) || Boolean(loading);

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      className={container({ variant, size, fullWidth, isDisabled })}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[color.primary, color.secondary] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text variant="label" tone={labelTone[variant ?? "primary"]}>
        {loading ? "…" : label}
      </Text>
    </Pressable>
  );
});
