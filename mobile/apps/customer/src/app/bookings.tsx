import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen, Text, StatusPill } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useMyBookings } from "@/features/booking";

// The customer's booking history. Tap a row to open its live status.
export default function Bookings() {
  const { t } = useTranslation("booking");
  const router = useRouter();
  const { data, isLoading } = useMyBookings();
  const bookings = data?.bookings ?? [];

  return (
    <Screen>
      <View className="flex-1 px-mobile-margin pt-md">
        <Text variant="headline" className="pb-md">
          {t("history.title")}
        </Text>
        <FlashList
          data={bookings}
          keyExtractor={(item, index) => item.booking_id ?? String(index)}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          ListEmptyComponent={isLoading ? null : <Text tone="muted">{t("history.empty")}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                item.booking_id &&
                router.push({ pathname: "/booking/[id]", params: { id: item.booking_id } })
              }
              className="rounded-card border border-outline-variant bg-surface-container-lowest p-md"
            >
              <View className="flex-row items-center justify-between">
                <Text variant="label">{item.service_name ?? ""}</Text>
                <StatusPill label={item.state ?? ""} tone="neutral" />
              </View>
              {item.quoted_total ? (
                <Text variant="caption" tone="muted">
                  ₹{item.quoted_total}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}
