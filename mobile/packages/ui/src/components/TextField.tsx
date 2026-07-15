import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { tv } from "tailwind-variants";

import { Text } from "./Text";

// A labelled text input on the shared tokens. Variant-driven (error state), ref-forwarded, and
// accessible: the label is spoken with the field. This is the design-system input every form and
// the OTP entry build on, so its look changes in one place.
const field = tv({
  base: "rounded-md border px-sm py-sm font-body text-body-md text-on-surface",
  variants: {
    state: {
      default: "border-outline-variant",
      error: "border-error",
    },
  },
  defaultVariants: { state: "default" },
});

export interface TextFieldProps extends Omit<TextInputProps, "className"> {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, accessibilityLabel, ...rest },
  ref,
) {
  return (
    <View className="gap-1">
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={accessibilityLabel ?? label}
        className={field({ state: error ? "error" : "default" })}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
