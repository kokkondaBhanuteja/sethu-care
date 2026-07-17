import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import {
  Screen,
  Text,
  Card,
  StatusPill,
  Skeleton,
  EmptyState,
  ErrorState,
  PressableScale,
  TAB_BAR_CLEARANCE,
} from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useMyBookings } from "@/features/booking";

// The customer's booking history. Tap a row to open its live status. Loading shows skeletons; a
// failed load offers a retry.
export default function Bookings() {
  const { t } = useTranslation(["booking", "common"]);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyBookings();
  const bookings = data?.bookings ?? [];

  return (
    <Screen>
      <View className="flex-1 px-mobile-margin pt-md">
        <Text variant="headline" className="pb-md">
          {t("booking:history.title")}
        </Text>
        {isError ? (
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <View className="gap-sm">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-20 w-full" />
            ))}
          </View>
        ) : (
          <FlashList
            data={bookings}
            keyExtractor={(item, index) => item.booking_id ?? String(index)}
            contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
            ItemSeparatorComponent={() => <View className="h-sm" />}
            ListEmptyComponent={
              <EmptyState illustration="emptyBookings" title={t("booking:history.empty")} />
            }
            renderItem={({ item }) => (
              <PressableScale
                onPress={() =>
                  item.booking_id &&
                  router.push({ pathname: "/booking/[id]", params: { id: item.booking_id } })
                }
              >
                <Card className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <Text variant="label">{item.service_name ?? ""}</Text>
                    <StatusPill label={item.state ?? ""} tone="neutral" />
                  </View>
                  {item.quoted_total ? (
                    <Text variant="caption" tone="muted">
                      ₹{item.quoted_total}
                    </Text>
                  ) : null}
                </Card>
              </PressableScale>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
