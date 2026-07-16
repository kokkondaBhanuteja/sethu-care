import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Text, Skeleton, EmptyState, ErrorState } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useServices, ServiceCard } from "@/features/catalog";

// Authenticated home — the service catalog (real read path via the generated query hook, rendered
// on FlashList). Loading shows skeletons; a failed load offers a retry.
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useServices();
  const services = data?.services ?? [];

  return (
    <Screen>
      <View className="flex-1 px-mobile-margin">
        <View className="flex-row items-center justify-between py-md">
          <Text variant="headline" tone="primary">
            {t("common:appName")}
          </Text>
          <View className="flex-row gap-md">
            <Pressable onPress={() => router.push("/bookings")} accessibilityRole="button">
              <Text variant="label" tone="primary">
                {t("booking:history.title")}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push("/settings")} accessibilityRole="button">
              <Text variant="label" tone="primary">
                {t("common:actions.settings")}
              </Text>
            </Pressable>
          </View>
        </View>
        {isError ? (
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <View className="gap-md pt-sm">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-24 w-full" />
            ))}
          </View>
        ) : (
          <FlashList
            data={services}
            keyExtractor={(item, index) => item.id ?? String(index)}
            renderItem={({ item }) => (
              <ServiceCard
                service={item}
                onPress={() =>
                  item.id && router.push({ pathname: "/service/[id]", params: { id: item.id } })
                }
              />
            )}
            ItemSeparatorComponent={() => <View className="h-md" />}
            ListEmptyComponent={<EmptyState title={t("common:empty.title")} />}
          />
        )}
      </View>
    </Screen>
  );
}
