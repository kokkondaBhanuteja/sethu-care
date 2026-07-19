import { useMemo, useState } from "react";
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
  type StatusTone,
} from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";
import { useMyBookings, TERMINAL_STATES } from "@/features/booking";
import { errorIllustration } from "@/lib/error-illustration";

type Filter = "all" | "active" | "completed";
const FILTERS: Filter[] = ["all", "active", "completed"];

// Map a backend state to a readable i18n status key + a pill tone.
const STATE_KEY: Record<string, string> = {
  PENDING: "pending",
  SEARCHING: "searching",
  ASSIGNED: "assigned",
  EN_ROUTE: "enRoute",
  ARRIVED: "arrived",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
};
function toneFor(state: string): StatusTone {
  if (state === "COMPLETED") return "success";
  if (state === "CANCELLED" || state === "FAILED") return "danger";
  return "info";
}
function formatSchedule(iso?: string): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toDateString();
}

export default function Bookings() {
  const { t } = useTranslation(["booking", "common"]);
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMyBookings();
  const [filter, setFilter] = useState<Filter>("all");
  const bookings = data?.bookings ?? [];

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    return bookings.filter((booking) => {
      const terminal = TERMINAL_STATES.has(booking.state ?? "");
      return filter === "completed" ? terminal : !terminal;
    });
  }, [bookings, filter]);

  // Filter pills live inside the list header so the native large-title header insets them correctly.
  const filterBar = (
    <View className="flex-row gap-sm pb-sm pt-sm">
      {FILTERS.map((key) => {
        const active = filter === key;
        return (
          <PressableScale key={key} onPress={() => setFilter(key)} scaleTo={0.96}>
            <View
              className={`rounded-full px-md py-1 ${
                active ? "bg-primary" : "bg-surface-container-high"
              }`}
            >
              <Text variant="caption" tone={active ? "inverse" : "muted"}>
                {t(`booking:filters.${key}`)}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );

  const listEmpty = isError ? (
    <ErrorState
      illustration={errorIllustration(error)}
      title={t("common:errors.generic")}
      retryLabel={t("common:actions.retry")}
      onRetry={() => void refetch()}
    />
  ) : isLoading ? (
    <View className="gap-sm">
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-24 w-full" />
      ))}
    </View>
  ) : (
    <EmptyState illustration="emptyBookings" title={t("booking:history.empty")} />
  );

  return (
    <Screen edges={["bottom"]}>
      <FlashList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(item, index) => item.booking_id ?? String(index)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={filterBar}
        ItemSeparatorComponent={() => <View className="h-sm" />}
        ListEmptyComponent={listEmpty}
        renderItem={({ item }) => {
          const state = item.state ?? "";
          const statusLabel = STATE_KEY[state] ? t(`booking:status.${STATE_KEY[state]}`) : state;
          const schedule = formatSchedule(item.scheduled_for);
          return (
            <PressableScale
              onPress={() =>
                item.booking_id &&
                router.push({ pathname: "/booking/[id]", params: { id: item.booking_id } })
              }
            >
              <Card className="gap-sm">
                <View className="flex-row items-center justify-between gap-sm">
                  <Text variant="label" className="flex-1" numberOfLines={1}>
                    {item.service_name ?? ""}
                  </Text>
                  <StatusPill label={statusLabel} tone={toneFor(state)} />
                </View>
                {schedule || item.city ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[schedule, item.city].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {item.quoted_total ? (
                  <Text variant="caption" tone="primary">
                    ₹{item.quoted_total}
                  </Text>
                ) : null}
              </Card>
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}
