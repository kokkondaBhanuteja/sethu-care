import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Text, Button, Card } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import { useService } from "@/features/catalog";

// Service detail: the variants of a service. Booking a variant carries its id + price to the
// confirm screen.
export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation("booking");
  const { data: service } = useService(id ?? "");
  const variants = service?.variants ?? [];

  return (
    <Screen>
      <View className="flex-1 gap-sm px-mobile-margin pt-md">
        <Text variant="headline">{service?.name ?? ""}</Text>
        {service?.description ? (
          <Text variant="body" tone="muted">
            {service.description}
          </Text>
        ) : null}
        <FlashList
          data={variants}
          keyExtractor={(variant, index) => variant.id ?? String(index)}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          renderItem={({ item }) => (
            <Card className="flex-row items-center justify-between gap-md">
              <View className="flex-1">
                <Text variant="label">{item.name ?? ""}</Text>
                {item.price_paise != null ? (
                  <Text variant="label" tone="primary" className="pt-1">
                    {formatPaise(item.price_paise)}
                  </Text>
                ) : null}
              </View>
              <Button
                label={t("book.cta")}
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/book/confirm",
                    params: {
                      variantId: item.id ?? "",
                      variantName: item.name ?? "",
                      pricePaise: String(item.price_paise ?? 0),
                    },
                  })
                }
              />
            </Card>
          )}
        />
      </View>
    </Screen>
  );
}
