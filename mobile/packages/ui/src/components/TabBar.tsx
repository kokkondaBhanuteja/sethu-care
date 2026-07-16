import { forwardRef, type ReactNode } from "react";
import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";

// Presentational bottom navigation. Wired to expo-router's headless <TabList asChild> and
// <TabTrigger asChild> in each app's (tabs)/_layout — so this package stays framework-agnostic and
// both apps share one bar. TabList/TabTrigger inject style/press props via asChild slots, hence the
// forwardRef + prop spread.
export interface TabBarProps extends ViewProps {
  children: ReactNode;
}

export const TabBar = forwardRef<View, TabBarProps>(function TabBar(
  { children, style, ...rest },
  ref,
) {
  const insets = useSafeAreaInsets();
  return (
    <View
      ref={ref}
      style={[{ paddingBottom: Math.max(insets.bottom, 10) }, style]}
      className="flex-row border-t border-outline-variant bg-surface-container-lowest px-sm pt-xs"
      {...rest}
    >
      {children}
    </View>
  );
});

export interface TabBarButtonProps extends Omit<PressableProps, "children"> {
  icon: IconName;
  label: string;
  isFocused?: boolean;
  /** Injected by <TabTrigger asChild>; not forwarded to the underlying Pressable. */
  href?: string;
}

export const TabBarButton = forwardRef<View, TabBarButtonProps>(function TabBarButton(
  { icon, label, isFocused, href: _href, style, ...rest },
  ref,
) {
  const tone = isFocused ? "primary" : "muted";
  // The TabTrigger slot injects a plain style object; drop the (unused) function form so we can
  // merge it. Layout goes through this inline style — not className — so our column direction wins
  // over the row-direction style the slot injects, keeping the icon above the label.
  const injectedStyle = typeof style === "function" ? undefined : style;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={[
        injectedStyle,
        {
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingVertical: 6,
        },
      ]}
      {...rest}
    >
      <Icon name={icon} size={24} tone={tone} strokeWidth={isFocused ? 2.4 : 2} />
      <Text variant="caption" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
});
