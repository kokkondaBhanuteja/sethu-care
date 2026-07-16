import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { color } from "@sethu/tokens";

import { Icon } from "./Icon";

// A rounded search input with a leading magnifier, on a solid surface so it reads on top of the
// gradient hero. Controlled like any TextInput.
export interface SearchFieldProps extends Omit<TextInputProps, "className"> {
  accessibilityLabel?: string;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { placeholder, accessibilityLabel, ...rest },
  ref,
) {
  return (
    <View className="flex-row items-center gap-sm rounded-full bg-surface-container-lowest px-md py-1 shadow-md shadow-inverse-surface/10">
      <Icon name="search" size={20} tone="muted" />
      <TextInput
        ref={ref}
        placeholder={placeholder}
        placeholderTextColor={color.onSurfaceVariant}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        className="flex-1 py-sm font-body text-body-md text-on-surface"
        {...rest}
      />
    </View>
  );
});
