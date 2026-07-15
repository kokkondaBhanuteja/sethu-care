import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Text, StatusPill } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useMyJobs } from "@/features/jobs";

// The technician's job list. Each row opens the job's lifecycle screen. Polls in the background
// (useMyJobs) so a freshly-assigned job appears on its own.
export default function Jobs() {
  const { t } = useTranslation("jobs");
  const router = useRouter();
  const { data, isLoading } = useMyJobs();
  const jobs = data?.jobs ?? [];

  return (
    <Screen>
      <View className="flex-1 px-mobile-margin pt-md">
        <Text variant="headline">{t("list.title")}</Text>
        <Text variant="caption" tone="muted" className="pb-md">
          {t("list.subtitle")}
        </Text>

        {jobs.length === 0 ? (
          <Text tone="muted">{isLoading ? "" : t("list.empty")}</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-sm pb-xl">
              {jobs.map((job, index) => (
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
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
