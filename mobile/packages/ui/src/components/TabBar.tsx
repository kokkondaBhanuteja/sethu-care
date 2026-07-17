import { forwardRef, type ReactNode } from "react";
import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { GlassSurface } from "./GlassSurface";

// The floating, Apple-style glass bottom navigation — real Liquid Glass on iOS 26, a frosted
// expo-blur fallback elsewhere (via GlassSurface). It floats over the page so content scrolls behind
// the glass. Wired to expo-router's headless <TabList asChild> / <TabTrigger asChild> in each app's
// (tabs)/_layout, so this package stays framework-agnostic and both apps share one bar.
//
// Because it floats, each tab screen must leave bottom clearance (~TAB_BAR_CLEARANCE) so its last
// content isn't hidden behind the bar.
export const TAB_BAR_CLEARANCE = 96;

export interface TabBarProps extends ViewProps {
  children: ReactNode;
}

export const TabBar = forwardRef<View, TabBarProps>(function TabBar(
  { children, style, ...rest },
  ref,
) {
  const insets = useSafeAreaInsets();
  const injectedStyle = typeof style === "function" ? undefined : style;
  return (
    <View
      ref={ref}
      pointerEvents="box-none"
      style={[
        injectedStyle,
        {
          // flexDirection column overrides the row style the TabList slot injects, so the glass bar
          // stretches to the full width (left:16→right:16) instead of collapsing to content.
          flexDirection: "column",
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
      {...rest}
    >
      <GlassSurface
        intensity={50}
        tint="light"
        className="flex-row items-center rounded-full border border-outline-variant/60 bg-surface-container-lowest/80 px-xs py-1 shadow-lg shadow-inverse-surface/25"
      >
        {children}
      </GlassSurface>
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
