import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import {
  Screen,
  Text,
  SearchField,
  Skeleton,
  ErrorState,
  Icon,
  AppImage,
  OfferBadge,
  PressableScale,
  type IconName,
} from "@sethu/ui";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";
import {
  useServices,
  serviceImage,
  servicePhoto,
  serviceIcon,
  heroMascot,
} from "@/features/catalog";

// Rotating, Google-Maps-style search prompts (cross-faded while the field is empty).
const SEARCH_PROMPTS = [
  "Need an electrician today?",
  "Looking for a plumber nearby?",
  "Book an AC service in minutes.",
  "Cleaning services near you.",
  "Need help fixing something?",
  "Find trusted home services.",
  "Search services near you.",
];

// Warm neutral card behind the clay service icons and the trust row (matches the "Casa" reference).
const CREAM = "#F3EEE5";

// Home (Casa-style): SETHU+ wordmark + notification bell, a swipeable photo hero, a cream-card service
// grid, a limited-time offer, and a trust row. The bottom bar is the custom pill with a centre FAB.
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch, isRefetching } = useServices();
  const services = data?.services ?? [];
  const gridServices = services.slice(0, 8);
  const [heroIndex, setHeroIndex] = useState(0);

  // Hero carousel — the first card is the big waving handyman mascot; the rest are photo promos.
  const heroSlides = [
    { key: "hero1", tagline: t("common:home.hero1"), kind: "mascot" as const },
    { key: "hero2", tagline: t("common:home.hero2"), kind: "photo" as const, slug: "ac-repair" },
    { key: "hero3", tagline: t("common:home.hero3"), kind: "photo" as const, slug: "electrical" },
  ];

  const trust: Array<{ icon: IconName; label: string }> = [
    { icon: "shield", label: t("common:home.trustVerified") },
    { icon: "checkCircle", label: t("common:home.trustWarranty") },
    { icon: "phone", label: t("common:home.trustSupport") },
  ];

  const openService = (id?: string) =>
    id && router.push({ pathname: "/service/[id]", params: { id } });

  const onHeroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setHeroIndex(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <Screen edges={["top"]}>
      {/* Header — brand wordmark + notification bell */}
      <View className="flex-row items-center justify-between px-mobile-margin pb-sm pt-xs">
        <Text variant="headline" tone="primary" className="font-heading">
          SETHU+
        </Text>
        <PressableScale
          onPress={() => router.push("/offers")}
          accessibilityLabel={t("common:nav.offers")}
          scaleTo={0.9}
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Icon name="bell" tone="inverse" size={20} />
            <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-error px-1">
              <Text variant="caption" tone="inverse" className="text-[10px]">
                2
              </Text>
            </View>
          </View>
        </PressableScale>
      </View>

      {/* Search — opens the dedicated search screen (keeps the rotating placeholder). */}
      <View className="px-mobile-margin pb-sm">
        <PressableScale
          onPress={() => router.push("/search")}
          accessibilityLabel={t("common:search.placeholder")}
          scaleTo={0.99}
        >
          <View pointerEvents="none">
            <SearchField
              editable={false}
              placeholder={t("common:home.search")}
              placeholders={SEARCH_PROMPTS}
            />
          </View>
        </PressableScale>
      </View>

      {isError ? (
        <ErrorState
          illustration="serverError"
          title={t("common:errors.generic")}
          retryLabel={t("common:actions.retry")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <View className="gap-md px-mobile-margin pt-sm">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-40 w-full" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={color.primary}
              colors={[color.primary]}
            />
          }
        >
          {/* Hero carousel */}
          <Animated.View entering={FadeInDown.duration(350)}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onHeroScroll}
            >
              {heroSlides.map((slide) => (
                <View key={slide.key} style={{ width }} className="px-mobile-margin">
                  <View
                    className="flex-row overflow-hidden rounded-card bg-primary"
                    style={{ height: 194 }}
                  >
                    <View className="flex-1 justify-center gap-sm p-md">
                      <Text variant="headline" tone="inverse">
                        {slide.tagline}
                      </Text>
                      <View className="self-start rounded-full bg-surface-container-lowest px-md py-1.5">
                        <Text variant="caption" tone="primary">
                          {t("common:nav.bookNow")}
                        </Text>
                      </View>
                    </View>
                    {slide.kind === "mascot" ? (
                      // Large mascot filling the right of the card, bleeding to the bottom edge.
                      <View
                        style={{
                          width: 176,
                          height: 194,
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        <AppImage
                          source={heroMascot}
                          placeholderColor="transparent"
                          contentFit="contain"
                          style={{ width: 210, height: 200 }}
                        />
                      </View>
                    ) : (
                      <AppImage
                        source={servicePhoto(slide.slug)}
                        placeholderIcon="briefcase"
                        placeholderIconTone="inverse"
                        placeholderColor="rgba(255,255,255,0.16)"
                        contentFit="cover"
                        style={{ width: 150, height: 194 }}
                      />
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            {/* Dots */}
            <View className="flex-row justify-center gap-1 pt-sm">
              {heroSlides.map((slide, index) => (
                <View
                  key={slide.key}
                  className={`h-2 rounded-full ${
                    index === heroIndex ? "w-5 bg-primary" : "w-2 bg-outline-variant"
                  }`}
                />
              ))}
            </View>
          </Animated.View>

          {/* Our Services */}
          <Animated.View
            entering={FadeInDown.duration(350).delay(80)}
            className="px-mobile-margin pt-lg"
          >
            <View className="flex-row items-center justify-between pb-md">
              <Text variant="headlineSm">{t("common:home.ourServices")}</Text>
              <PressableScale onPress={() => router.push("/categories")} scaleTo={0.96}>
                <Text variant="caption" tone="primary">
                  {t("common:home.viewAll")}
                </Text>
              </PressableScale>
            </View>
            <View className="flex-row flex-wrap justify-between gap-y-md">
              {gridServices.map((service) => (
                <PressableScale
                  key={service.id}
                  onPress={() => openService(service.id)}
                  accessibilityLabel={service.name}
                  scaleTo={0.95}
                  style={{ width: "23%" }}
                >
                  <View className="items-center gap-1">
                    <View
                      className="w-full items-center justify-center rounded-2xl p-2"
                      style={{ aspectRatio: 1, backgroundColor: CREAM }}
                    >
                      <AppImage
                        source={serviceImage(service.slug)}
                        placeholderIcon={serviceIcon(service.name)}
                        placeholderColor="transparent"
                        contentFit="contain"
                        style={{ width: "88%", height: "88%" }}
                      />
                    </View>
                    <Text
                      variant="caption"
                      numberOfLines={2}
                      className="text-center"
                      style={{ minHeight: 32 }}
                    >
                      {service.name ?? ""}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </Animated.View>

          {/* Limited-time offer */}
          <Animated.View
            entering={FadeInDown.duration(350).delay(160)}
            className="px-mobile-margin pt-lg"
          >
            <View className="flex-row items-center gap-md rounded-card bg-primary-container p-md">
              <OfferBadge percent="20%" label="OFF" size={84} />
              <View className="flex-1 gap-1">
                <Text variant="label">{t("common:home.offerTitle")}</Text>
                <Text variant="caption" tone="muted">
                  {t("common:home.offerSubtitle")}
                </Text>
                <PressableScale
                  onPress={() => router.push("/categories")}
                  accessibilityLabel={t("common:nav.bookNow")}
                  scaleTo={0.96}
                >
                  <View className="mt-1 self-start rounded-full bg-primary px-lg py-2">
                    <Text variant="caption" tone="inverse">
                      {t("common:nav.bookNow")}
                    </Text>
                  </View>
                </PressableScale>
              </View>
            </View>
          </Animated.View>

          {/* Trust row */}
          <Animated.View
            entering={FadeInDown.duration(350).delay(220)}
            className="px-mobile-margin pt-md"
          >
            <View
              className="flex-row items-center rounded-card p-md"
              style={{ backgroundColor: CREAM }}
            >
              {trust.map((item, index) => (
                <View key={item.label} className="flex-1 flex-row items-center">
                  {index > 0 ? <View className="h-8 w-px bg-outline-variant" /> : null}
                  <View className="flex-1 flex-row items-center justify-center gap-1">
                    <Icon name={item.icon} tone="primary" size={17} />
                    <Text variant="caption" numberOfLines={2} className="flex-shrink text-[11px]">
                      {item.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </Screen>
  );
}
