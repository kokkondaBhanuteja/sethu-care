import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import {
  Screen,
  Text,
  Hero,
  Card,
  Icon,
  StatusPill,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@sethu/ui";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

import { useMyJobs } from "@/features/jobs";
import { useSetAvailability } from "@/features/availability";
import { useMyCash } from "@/features/earnings";

// The technician's home: a gradient hero with the online/offline switch, a cash-to-deposit reminder,
// and the job list. Jobs poll in the background so a freshly-assigned one appears on its own.
export default function Jobs() {
  const { t } = useTranslation(["jobs", "common"]);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyJobs();
  const jobs = data?.jobs ?? [];

  const setAvailability = useSetAvailability();
  const [online, setOnline] = useState(false);
  // Optimistic flip: reflect the switch immediately, roll back if the request fails.
  const toggleOnline = (value: boolean) => {
    setOnline(value);
    setAvailability.mutate({ body: { online: value } }, { onError: () => setOnline(!value) });
  };

  const cash = useMyCash();
  const outstanding = cash.data?.outstanding;
  const holdingCash = outstanding != null && Number(outstanding) > 0;

  return (
    <Screen edges={["top"]}>
      <Hero eyebrow={t("jobs:list.subtitle")} title={t("jobs:list.title")}>
        <Card padded={false} className="flex-row items-center justify-between p-md">
          <View className="flex-row items-center gap-sm">
            <Icon name={online ? "online" : "offline"} tone={online ? "success" : "muted"} />
            <Text variant="label" tone={online ? "default" : "muted"}>
              {online ? t("jobs:status.online") : t("jobs:status.offline")}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={toggleOnline}
            trackColor={{ false: color.outlineVariant, true: color.primary }}
          />
        </Card>
      </Hero>

      <View className="flex-1 px-mobile-margin pt-md">
        {holdingCash ? (
          <Pressable onPress={() => router.push("/earnings")} accessibilityRole="button">
            <Card className="mb-md flex-row items-center gap-md">
              <View className="h-11 w-11 items-center justify-center rounded-card bg-primary-container">
                <Icon name="payment" tone="primary" />
              </View>
              <View className="flex-1">
                <Text variant="caption" tone="muted">
                  {t("jobs:earnings.title")}
                </Text>
                <Text variant="label" tone="primary">
                  {t("jobs:earnings.outstanding", { amount: `₹${outstanding}` })}
                </Text>
              </View>
              <Icon name="chevronRight" tone="muted" />
            </Card>
          </Pressable>
        ) : null}

        {isError ? (
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <View className="gap-sm">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-24 w-full" />
            ))}
          </View>
        ) : (
          <FlashList
            data={jobs}
            keyExtractor={(item, index) => item.booking_id ?? String(index)}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View className="h-sm" />}
            ListEmptyComponent={<EmptyState icon="package" title={t("jobs:list.empty")} />}
            renderItem={({ item: job }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  job.booking_id &&
                  router.push({ pathname: "/job/[id]", params: { id: job.booking_id } })
                }
              >
                <Card className="gap-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-md">
                      <View className="h-11 w-11 items-center justify-center rounded-card bg-primary-container">
                        <Icon name="service" tone="primary" />
                      </View>
                      <View className="flex-1">
                        <Text variant="label">{job.service_name ?? ""}</Text>
                        <Text variant="caption" tone="muted">
                          {[job.customer_name, job.city].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                    </View>
                    <StatusPill label={job.state ?? ""} tone="active" />
                  </View>
                  {job.quoted_total ? (
                    <Text variant="label" tone="primary">
                      ₹{job.quoted_total}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
