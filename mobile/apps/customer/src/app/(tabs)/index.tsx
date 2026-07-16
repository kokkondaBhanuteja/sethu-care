import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Hero, SearchField, Skeleton, EmptyState, ErrorState } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useServices, ServiceCard } from "@/features/catalog";

// Authenticated home — a gradient hero with a live search over the service catalog (real read path
// via the generated query hook, rendered on FlashList). Loading shows skeletons; a failed load
// offers a retry.
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);
  const router = useRouter();
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

  return (
    <Screen edges={["top"]}>
      <Hero eyebrow={t("common:home.eyebrow")} title={t("common:home.tagline")}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("common:home.search")}
          returnKeyType="search"
        />
      </Hero>
      <View className="flex-1 px-mobile-margin pt-md">
        {isError ? (
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <View className="gap-md pt-sm">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-20 w-full" />
            ))}
          </View>
        ) : (
          <FlashList
            data={filtered}
            keyExtractor={(item, index) => item.id ?? String(index)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ServiceCard
                service={item}
                onPress={() =>
                  item.id && router.push({ pathname: "/service/[id]", params: { id: item.id } })
                }
              />
            )}
            ItemSeparatorComponent={() => <View className="h-md" />}
            ListEmptyComponent={
              <EmptyState
                icon="search"
                title={query ? t("common:home.noResults") : t("common:empty.title")}
              />
            }
          />
        )}
      </View>
    </Screen>
  );
}
