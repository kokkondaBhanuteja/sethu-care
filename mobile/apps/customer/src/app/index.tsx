import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Text } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useServices, ServiceCard } from "@/features/catalog";

// Authenticated home — the service catalog (real read path via the generated query hook, rendered
// on FlashList). Booking a service (optimistic) and the address/confirm flow follow next.
export default function Home() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data, isLoading } = useServices();
  const services = data?.services ?? [];

  return (
    <Screen>
      <View className="flex-1 px-mobile-margin">
        <View className="flex-row items-center justify-between py-md">
          <Text variant="headline" tone="primary">
            {t("appName")}
          </Text>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button">
            <Text variant="label" tone="primary">
              {t("actions.settings")}
            </Text>
          </Pressable>
        </View>
        <FlashList
          data={services}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              onPress={() => item.id && router.push({ pathname: "/service/[id]", params: { id: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-md" />}
          ListEmptyComponent={isLoading ? null : <Text tone="muted">{t("empty.title")}</Text>}
        />
      </View>
    </Screen>
  );
}
