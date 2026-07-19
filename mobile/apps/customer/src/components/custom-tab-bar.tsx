import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import MaskedView from "@react-native-masked-view/masked-view";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Text, Icon, PressableScale, type IconName } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Minimal shape of the props expo-router's <Tabs tabBar={...}> passes (a react-navigation
// BottomTabBarProps subset). Typed locally because @react-navigation/bottom-tabs isn't a direct
// dependency and the deep expo-router path is unstable across versions.
interface TabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
}

const TAB_ICON: Record<string, IconName> = {
  index: "home",
  bookings: "bookings",
  offers: "tag",
  account: "account",
};

const BAR_HEIGHT = 62;
const CORNER = 26;
const FAB = 56;

// The bar background is the whole rounded rect MINUS a concave notch in the top-centre, so the FAB
// nests into a cradle (the react-native-paper / Casa look). Eased in and out of a semicircular dip.
function barPath(width: number): string {
  const cx = width / 2;
  const mouth = 44; // half-width of the notch opening
  const arc = mouth - 12; // radius of the semicircle at the bottom of the notch
  return [
    `M0 0`,
    `H${cx - mouth}`,
    `Q ${cx - mouth + 8} 0 ${cx - arc} 8`,
    `A ${arc} ${arc} 0 0 0 ${cx + arc} 8`,
    `Q ${cx + mouth - 8} 0 ${cx + mouth} 0`,
    `H${width}`,
    `V${BAR_HEIGHT}`,
    `H0`,
    `Z`,
  ].join(" ");
}

// The frosted-glass surface for the bar, with the top-centre notch cut into it, so the glass itself
// bends around the FAB. Common structure on both platforms — a MaskedView clips the glass fill to the
// notch path — differing only in the fill: REAL iOS 26 Liquid Glass (expo-glass-effect GlassView) on
// iOS, an expo-blur frosted BlurView (over a translucent white for legibility) on Android and older
// iOS. rdev/liquid-glass-react can't be used here — it's a DOM/CSS library with no React Native port.
function BarGlassFill({ barWidth }: { barWidth: number }) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        style={{ width: barWidth, height: BAR_HEIGHT, borderRadius: CORNER }}
      />
    );
  }
  return (
    <View style={{ width: barWidth, height: BAR_HEIGHT }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.72)" }]} />
      <BlurView
        intensity={24}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function BarBackground({ barWidth }: { barWidth: number }) {
  return (
    <View
      className="shadow-md shadow-inverse-surface/20"
      style={{ position: "absolute", bottom: 0, width: barWidth, height: BAR_HEIGHT }}
    >
      <MaskedView
        style={{ width: barWidth, height: BAR_HEIGHT }}
        maskElement={
          <Svg width={barWidth} height={BAR_HEIGHT}>
            <Path d={barPath(barWidth)} fill="#000000" />
          </Svg>
        }
      >
        <BarGlassFill barWidth={barWidth} />
      </MaskedView>
    </View>
  );
}

// Floating tab bar with a notched cradle + raised squircle "Book Now" FAB (matches the reference
// footer). Home · Bookings · [Book Now] · Offers · Profile. Replaces the native bar so a primary
// action can sit in the middle.
export function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation("common");

  const barWidth = width - 32;
  const activeName = state.routes[state.index]?.name;

  const labelFor = (name: string) =>
    name === "index"
      ? t("nav.home")
      : name === "bookings"
        ? t("nav.bookings")
        : name === "offers"
          ? t("nav.offers")
          : t("nav.profile");

  const renderTab = (name: string) => {
    const route = state.routes.find((candidate) => candidate.name === name);
    if (!route) return <View className="flex-1" />;
    const focused = activeName === name;
    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <PressableScale
        key={route.key}
        onPress={onPress}
        accessibilityLabel={labelFor(name)}
        scaleTo={0.9}
        style={{ flex: 1 }}
      >
        <View className="items-center gap-0.5">
          <View className="h-8 w-14 items-center justify-center rounded-full">
            {focused ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                className="absolute inset-0 rounded-full bg-primary-container"
              />
            ) : null}
            <Icon
              name={TAB_ICON[name] ?? "home"}
              size={22}
              tone={focused ? "primary" : "muted"}
              weight={focused ? "fill" : "regular"}
            />
          </View>
          <Text variant="caption" tone={focused ? "primary" : "muted"}>
            {labelFor(name)}
          </Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 6, paddingTop: 30 }}>
      <View style={{ height: BAR_HEIGHT, width: barWidth }}>
        <BarBackground barWidth={barWidth} />

        {/* Foreground: tabs + centre FAB, not clipped so the FAB can poke above the notch. */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            width: barWidth,
            height: BAR_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {renderTab("index")}
          {renderTab("bookings")}

          <View className="flex-1 items-center">
            <PressableScale
              onPress={() => router.push("/categories")}
              accessibilityLabel={t("nav.bookNow")}
              scaleTo={0.9}
            >
              <View className="items-center" style={{ gap: 4 }}>
                {/* Squircle FAB — a rounded square rotated to a diamond; icon counter-rotated upright. */}
                <View
                  className="items-center justify-center bg-primary shadow-md shadow-primary/40"
                  style={{
                    width: FAB,
                    height: FAB,
                    borderRadius: 18,
                    marginTop: -34,
                    transform: [{ rotate: "45deg" }],
                  }}
                >
                  <View style={{ transform: [{ rotate: "-45deg" }] }}>
                    <Icon name="plus" size={26} tone="inverse" />
                  </View>
                </View>
                <Text variant="caption" tone="primary" style={{ marginTop: -2 }}>
                  {t("nav.bookNow")}
                </Text>
              </View>
            </PressableScale>
          </View>

          {renderTab("offers")}
          {renderTab("account")}
        </View>
      </View>
    </View>
  );
}
