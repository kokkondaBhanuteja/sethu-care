import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import {
  Screen,
  Text,
  Card,
  AppImage,
  RatingPill,
  Skeleton,
  ErrorState,
  PressableScale,
} from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import { useServices, servicePhoto, serviceIcon, sampleRating } from "@/features/catalog";

// The full service catalogue as a vertical list (reached from the home "See all"). Each row: a photo
// thumbnail, name, tagline, starting price and rating → the service detail. Mirrors Casa's categories.
export default function Categories() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useServices();
  const services = data?.services ?? [];

  return (
    <Screen edges={["bottom"]}>
      {isError ? (
        <View className="px-mobile-margin pt-md">
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        </View>
      ) : isLoading ? (
        <View className="gap-sm px-mobile-margin pt-md">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </View>
      ) : (
        <FlashList
          data={services}
          keyExtractor={(item, index) => item.id ?? String(index)}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          renderItem={({ item }) => {
            const price = item.variants?.[0]?.price_paise;
            return (
              <PressableScale
                onPress={() =>
                  item.id && router.push({ pathname: "/service/[id]", params: { id: item.id } })
                }
                accessibilityLabel={item.name}
              >
                <Card padded={false} className="flex-row items-center gap-md p-sm">
                  <AppImage
                    source={servicePhoto(item.slug)}
                    placeholderIcon={serviceIcon(item.name)}
                    contentFit="cover"
                    style={{ width: 64, height: 64, borderRadius: 14 }}
                  />
                  <View className="flex-1 gap-1">
                    <Text variant="label" numberOfLines={1}>
                      {item.name ?? ""}
                    </Text>
                    {item.description ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View className="flex-row items-center gap-sm pt-1">
                      <RatingPill rating={sampleRating(item.id)} count="2.1k" />
                      {price != null ? (
                        <Text variant="caption" tone="primary">
                          {t("common:home.startingAt", { price: formatPaise(price) })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </PressableScale>
            );
          }}
        />
      )}
    </Screen>
  );
}
