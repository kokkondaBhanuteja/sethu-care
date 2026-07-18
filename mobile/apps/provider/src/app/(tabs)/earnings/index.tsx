import { ScrollView, View } from "react-native";
import { Screen, Text, Card, Icon, Skeleton, ErrorState, EmptyState } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useMyCash } from "@/features/earnings";

// Earnings tab (native large-title header) — the technician's cash standing: total collected,
// deposited, and what's still outstanding (owed to the company).
export default function Earnings() {
  const { t } = useTranslation(["jobs", "common"]);
  const { data, isLoading, isError, refetch } = useMyCash();

  const outstanding = data?.outstanding ?? "0";
  const holdingCash = Number(outstanding) > 0;

  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {isError ? (
          <ErrorState
            title={t("common:errors.generic")}
            retryLabel={t("common:actions.retry")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <View className="gap-md">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </View>
        ) : (
          <View className="gap-md">
            <Card className="items-center gap-1 py-xl">
              <Icon name="payment" tone={holdingCash ? "primary" : "muted"} size={28} />
              <Text variant="caption" tone="muted">
                {t("jobs:earnings.held")}
              </Text>
              <Text variant="displayLg" tone={holdingCash ? "primary" : "default"}>
                ₹{outstanding}
              </Text>
              {!holdingCash ? <EmptyState title={t("jobs:earnings.allClear")} /> : null}
            </Card>

            <View className="flex-row gap-md">
              <Card className="flex-1 gap-1">
                <Text variant="caption" tone="muted">
                  {t("jobs:earnings.collected")}
                </Text>
                <Text variant="label">₹{data?.collected ?? "0"}</Text>
              </Card>
              <Card className="flex-1 gap-1">
                <Text variant="caption" tone="muted">
                  {t("jobs:earnings.deposited")}
                </Text>
                <Text variant="label">₹{data?.deposited ?? "0"}</Text>
              </Card>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
