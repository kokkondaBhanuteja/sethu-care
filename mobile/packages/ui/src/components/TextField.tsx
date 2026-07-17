import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { tv } from "tailwind-variants";

import { Text } from "./Text";

// A labelled text input on the shared tokens. Variant-driven (error state), ref-forwarded, and
// accessible: the label is spoken with the field. This is the design-system input every form and
// the OTP entry build on, so its look changes in one place. An optional static `prefix` (e.g. a
// "+91" dial code) sits inside the border so the user types only the local part.
const field = tv({
  base: "rounded-md border font-body text-body-md text-on-surface",
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
  /** Static leading text inside the border, e.g. a "+91" dial code. */
  prefix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, prefix, accessibilityLabel, ...rest },
  ref,
) {
  const state = error ? "error" : "default";
  return (
    <View className="gap-1">
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      {prefix ? (
        <View className={`flex-row items-center ${field({ state })}`}>
          <Text variant="body" tone="muted" className="pl-sm">
            {prefix}
          </Text>
          <TextInput
            ref={ref}
            accessibilityLabel={accessibilityLabel ?? label}
            className="flex-1 px-1 py-sm font-body text-body-md text-on-surface"
            {...rest}
          />
        </View>
      ) : (
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel ?? label}
          className={`${field({ state })} px-sm py-sm`}
          {...rest}
        />
      )}
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
