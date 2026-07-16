import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Text, StatusPill, Skeleton, EmptyState, ErrorState } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useMyJobs } from "@/features/jobs";
import { useSetAvailability } from "@/features/availability";
import { useMyCash } from "@/features/earnings";

// The technician's home: an online/offline switch, a cash-to-deposit reminder, and the job list.
// Jobs poll in the background so a freshly-assigned one appears on its own.
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
    <Screen>
      <View className="flex-1 px-mobile-margin pt-md">
        <View className="flex-row items-center justify-between">
          <Text variant="headline">{t("jobs:list.title")}</Text>
          <View className="flex-row items-center gap-sm">
            <Text variant="label" tone={online ? "primary" : "muted"}>
              {online ? t("jobs:status.online") : t("jobs:status.offline")}
            </Text>
            <Switch value={online} onValueChange={toggleOnline} />
          </View>
        </View>
        <Text variant="caption" tone="muted" className="pb-md">
          {t("jobs:list.subtitle")}
        </Text>

        {holdingCash ? (
          <View className="mb-md gap-1 rounded-card border border-outline-variant bg-surface-container-lowest p-md">
            <Text variant="caption" tone="muted">
              {t("jobs:earnings.title")}
            </Text>
            <Text variant="label" tone="primary">
              {t("jobs:earnings.outstanding", { amount: `₹${outstanding}` })}
            </Text>
          </View>
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-sm pb-xl">
              {jobs.length === 0 ? (
                <EmptyState title={t("jobs:list.empty")} />
              ) : (
                jobs.map((job, index) => (
                  <Pressable
                    key={job.booking_id ?? String(index)}
                    accessibilityRole="button"
                    onPress={() =>
                      job.booking_id &&
                      router.push({ pathname: "/job/[id]", params: { id: job.booking_id } })
                    }
                    className="gap-1 rounded-card border border-outline-variant bg-surface-container-lowest p-md"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text variant="label">{job.service_name ?? ""}</Text>
                      <StatusPill label={job.state ?? ""} tone="active" />
                    </View>
                    <Text variant="caption" tone="muted">
                      {[job.customer_name, job.city].filter(Boolean).join(" · ")}
                    </Text>
                    {job.quoted_total ? (
                      <Text variant="caption" tone="primary">
                        ₹{job.quoted_total}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
