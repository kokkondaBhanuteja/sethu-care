import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import {
  Screen,
  Text,
  SearchField,
  Skeleton,
  EmptyState,
  ErrorState,
  Badge,
  Avatar,
  Icon,
  AppImage,
  PressableScale,
  TAB_BAR_CLEARANCE,
} from "@sethu/ui";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import { useServices, ServiceCard, CategoryTile } from "@/features/catalog";

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

// Rich, image-forward home (Swiggy / Urban-Company style): a location header, search, a solid-blue
// promo banner, a "What needs fixing?" category grid, and image-forward popular-service cards. Solid
// colours only. Sections fade/slide in on mount.
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);
  const router = useRouter();
  const user = useSession((state) => state.user);
  const { data, isLoading, isError, refetch } = useServices();
  const [query, setQuery] = useState("");
  const services = data?.services ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (service) =>
        (service.name ?? "").toLowerCase().includes(needle) ||
        (service.description ?? "").toLowerCase().includes(needle),
    );
  }, [services, query]);

  const openService = (id?: string) =>
    id && router.push({ pathname: "/service/[id]", params: { id } });

  return (
    <Screen edges={["top"]}>
      {/* Location + membership + avatar */}
      <View className="flex-row items-center justify-between px-mobile-margin pb-sm pt-xs">
        <View className="flex-1 flex-row items-center gap-xs">
          <Icon name="location" tone="primary" size={22} />
          <View className="flex-1">
            <Text variant="caption" tone="muted">
              {t("common:home.greeting")}
              {user?.name ? `, ${user.name}` : ""}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text variant="label" numberOfLines={1}>
                {t("common:home.location")}
              </Text>
              <Icon name="chevronRight" size={14} tone="muted" />
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-sm">
          <Badge label={t("common:home.member")} tone="accent" />
          <Avatar name={user?.name} size={38} />
        </View>
      </View>

      {/* Search */}
      <View className="px-mobile-margin pb-sm">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("common:home.search")}
          placeholders={SEARCH_PROMPTS}
          returnKeyType="search"
        />
      </View>

      {isError ? (
        <ErrorState
          title={t("common:errors.generic")}
          retryLabel={t("common:actions.retry")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <View className="gap-md px-mobile-margin pt-sm">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        >
          {/* Promo banner */}
          <Animated.View entering={FadeInDown.duration(350)} className="px-mobile-margin pt-xs">
            <PressableScale onPress={() => openService(services[0]?.id)}>
              <View className="flex-row items-center gap-md rounded-card bg-primary p-md">
                <View className="flex-1 gap-xs">
                  <Text variant="label" tone="inverse">
                    {t("common:home.promoTitle")}
                  </Text>
                  <Text variant="caption" tone="inverse" className="opacity-90">
                    {t("common:home.promoSubtitle")}
                  </Text>
                  <View className="self-start rounded-full bg-surface-container-lowest px-md py-1">
                    <Text variant="caption" tone="primary">
                      {t("common:home.promoCta")}
                    </Text>
                  </View>
                </View>
                <AppImage
                  placeholderIcon="tag"
                  placeholderIconTone="inverse"
                  placeholderColor="rgba(255,255,255,0.16)"
                  style={{ width: 88, height: 88, borderRadius: 20 }}
                />
              </View>
            </PressableScale>
          </Animated.View>

          {/* Category grid */}
          <Animated.View
            entering={FadeInDown.duration(350).delay(80)}
            className="px-mobile-margin pt-lg"
          >
            <Text variant="headlineSm" className="pb-md">
              {t("common:home.categoriesTitle")}
            </Text>
            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title={query ? t("common:home.noResults") : t("common:empty.title")}
              />
            ) : (
              <View className="flex-row flex-wrap justify-between gap-y-md">
                {filtered.map((service) => (
                  <CategoryTile
                    key={service.id}
                    service={service}
                    onPress={() => openService(service.id)}
                  />
                ))}
              </View>
            )}
          </Animated.View>

          {/* Popular services */}
          {filtered.length > 0 ? (
            <Animated.View
              entering={FadeInDown.duration(350).delay(160)}
              className="gap-md px-mobile-margin pt-lg"
            >
              <Text variant="headlineSm">{t("common:home.popularTitle")}</Text>
              {filtered.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onPress={() => openService(service.id)}
                />
              ))}
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
