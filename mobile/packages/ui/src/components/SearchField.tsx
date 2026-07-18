import { forwardRef, useEffect, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import Animated, { Easing, FadeInUp, FadeOutUp } from "react-native-reanimated";
import { color } from "@sethu/tokens";

import { Icon } from "./Icon";

// A rounded search input with a leading magnifier, a clear border + soft elevation, and an optional
// Google/Swiggy-style rotating placeholder. Each prompt rolls up: the current one slides up + fades
// out while the next rises in from below. Controlled like any TextInput.
export interface SearchFieldProps extends Omit<TextInputProps, "className"> {
  accessibilityLabel?: string;
  /** Rotating placeholder prompts, cross-faded every few seconds while empty + unfocused. */
  placeholders?: string[];
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { placeholder, accessibilityLabel, placeholders, value, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const rotating = Boolean(placeholders?.length) && !focused && !value;

  useEffect(() => {
    if (!rotating || !placeholders) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % placeholders.length),
      2600,
    );
    return () => clearInterval(timer);
  }, [rotating, placeholders]);

  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur: NonNullable<TextInputProps["onBlur"]> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <View className="flex-row items-center gap-sm rounded-full border border-outline-variant bg-surface-container-lowest px-md py-1 shadow-md shadow-inverse-surface/10">
      <Icon name="search" size={20} tone="muted" />
      <View className="flex-1 justify-center">
        <TextInput
          ref={ref}
          value={value}
          placeholder={rotating ? "" : placeholder}
          placeholderTextColor={color.onSurfaceVariant}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="py-sm font-body text-body-md text-on-surface"
          {...rest}
        />
        {rotating && placeholders ? (
          <View pointerEvents="none" className="absolute inset-x-0 justify-center overflow-hidden">
            <Animated.Text
              key={index}
              entering={FadeInUp.duration(420).easing(Easing.out(Easing.cubic))}
              exiting={FadeOutUp.duration(360).easing(Easing.in(Easing.cubic))}
              numberOfLines={1}
              style={{
                position: "absolute",
                color: color.onSurfaceVariant,
                fontSize: 16,
                fontFamily: "Inter_400Regular",
              }}
            >
              {placeholders[index]}
            </Animated.Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});
