import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Text, Card, AppImage, Icon, PressableScale, EmptyState } from "@sethu/ui";
import { color } from "@sethu/tokens";
import { formatPaise } from "@sethu/domain";
import { usePreferences } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import type { ServiceResponse } from "@sethu/api-client";
import { useServices, serviceImage, serviceIcon } from "@/features/catalog";

// Full-screen search (opened from the home search bar): recent-search chips + a trending grid while
// empty, and a live results list as you type. Mirrors the Casa /search reference.
export default function Search() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data } = useServices();
  const services = data?.services ?? [];
  const [query, setQuery] = useState("");
  const recent = usePreferences((state) => state.recentSearches);
  const addRecent = usePreferences((state) => state.addRecentSearch);
  const clearRecent = usePreferences((state) => state.clearRecentSearches);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    return services.filter(
      (service) =>
        (service.name ?? "").toLowerCase().includes(needle) ||
        (service.description ?? "").toLowerCase().includes(needle),
    );
  }, [services, needle]);

  const trending = services.slice(0, 6);

  const priceLabel = (service: ServiceResponse) => {
    const paise = service.variants?.[0]?.price_paise;
    return paise != null ? t("home.startingAt", { price: formatPaise(paise) }) : "";
  };

  const open = (service: ServiceResponse) => {
    if (query.trim()) addRecent(query.trim());
    if (service.id) router.push({ pathname: "/service/[id]", params: { id: service.id } });
  };

  return (
    <Screen edges={["top", "bottom"]}>
      {/* Search bar with back */}
      <View className="flex-row items-center gap-sm px-mobile-margin pb-sm pt-sm">
        <PressableScale onPress={() => router.back()} accessibilityLabel={t("actions.done")}>
          <Icon name="back" />
        </PressableScale>
        <View className="flex-1 flex-row items-center gap-sm rounded-full border border-outline-variant bg-surface-container-lowest px-md">
          <Icon name="search" size={20} tone="muted" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t("search.placeholder")}
            placeholderTextColor={color.onSurfaceVariant}
            returnKeyType="search"
            onSubmitEditing={() => query.trim() && addRecent(query.trim())}
            className="flex-1 py-sm font-body text-body-md text-on-surface"
          />
          {query.length > 0 ? (
            <PressableScale onPress={() => setQuery("")} accessibilityLabel={t("search.clear")}>
              <Icon name="close" size={18} tone="muted" />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {needle ? (
        <FlashList
          data={results}
          keyExtractor={(item, index) => item.id ?? String(index)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          ListEmptyComponent={<EmptyState icon="search" title={t("search.noResults", { query })} />}
          renderItem={({ item }) => (
            <PressableScale onPress={() => open(item)} accessibilityLabel={item.name}>
              <Card padded={false} className="flex-row items-center gap-md p-sm">
                <AppImage
                  source={serviceImage(item.slug)}
                  placeholderIcon={serviceIcon(item.name)}
                  contentFit="contain"
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                />
                <View className="flex-1">
                  <Text variant="label" numberOfLines={1}>
                    {item.name ?? ""}
                  </Text>
                  {priceLabel(item) ? (
                    <Text variant="caption" tone="primary">
                      {priceLabel(item)}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevronRight" size={16} tone="muted" />
              </Card>
            </PressableScale>
          )}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {recent.length > 0 ? (
            <View className="gap-sm pb-lg">
              <View className="flex-row items-center justify-between">
                <Text variant="label" tone="muted">
                  {t("search.recent")}
                </Text>
                <PressableScale onPress={clearRecent} scaleTo={0.96}>
                  <Text variant="caption" tone="primary">
                    {t("search.clear")}
                  </Text>
                </PressableScale>
              </View>
              <View className="flex-row flex-wrap gap-sm">
                {recent.map((term) => (
                  <PressableScale key={term} onPress={() => setQuery(term)} scaleTo={0.96}>
                    <View className="rounded-full bg-surface-container-high px-md py-1">
                      <Text variant="caption">{term}</Text>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          <Text variant="label" tone="muted" className="pb-sm">
            {t("search.trending")}
          </Text>
          <View className="flex-row flex-wrap justify-between gap-y-md">
            {trending.map((service) => (
              <View key={service.id} style={{ width: "48%" }}>
                <PressableScale
                  onPress={() => open(service)}
                  accessibilityLabel={service.name}
                  scaleTo={0.97}
                >
                  <Card className="gap-sm">
                    <AppImage
                      source={serviceImage(service.slug)}
                      placeholderIcon={serviceIcon(service.name)}
                      contentFit="contain"
                      style={{ width: 44, height: 44, borderRadius: 12 }}
                    />
                    <View className="gap-1">
                      <Text variant="label" numberOfLines={2}>
                        {service.name ?? ""}
                      </Text>
                      {priceLabel(service) ? (
                        <Text variant="caption" tone="muted">
                          {priceLabel(service)}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </PressableScale>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
