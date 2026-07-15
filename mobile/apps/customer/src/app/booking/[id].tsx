import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Text, Button, StatusPill, type StatusTone } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import { useBooking, useTransitionBooking } from "@/features/booking";

// A booking's live status. useBooking polls every 4s, so the pill updates as the backend advances
// the state machine. Allowed actions (from the booking) render as buttons.
export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id ?? "";
  const { t } = useTranslation(["booking", "common"]);
  const { data: booking, isLoading } = useBooking(bookingId);
  const transition = useTransitionBooking(bookingId);

  const state = booking?.state ?? "";
  const actions = booking?.allowed_actions ?? [];

  // Map a backend state to a pill tone + localized label; unknown states show as-is.
  const status: { tone: StatusTone; label: string } = (() => {
    switch (state) {
      case "SEARCHING":
        return { tone: "active", label: t("booking:status.searching") };
      case "ASSIGNED":
        return { tone: "active", label: t("booking:status.assigned") };
      case "EN_ROUTE":
        return { tone: "active", label: t("booking:status.enRoute") };
      case "ARRIVED":
        return { tone: "active", label: t("booking:status.arrived") };
      case "IN_PROGRESS":
        return { tone: "active", label: t("booking:status.inProgress") };
      case "COMPLETED":
        return { tone: "success", label: t("booking:status.completed") };
      case "CANCELLED":
        return { tone: "danger", label: t("booking:status.cancelled") };
      case "FAILED":
        return { tone: "danger", label: t("booking:status.failed") };
      default:
        return { tone: "neutral", label: state || t("booking:status.pending") };
    }
  })();

  const act = (action: string) => transition.mutate({ path: { id: bookingId }, body: { action } });

  return (
    <Screen>
      <View className="flex-1 gap-md px-mobile-margin pt-md">
        <Text variant="headline">{t("booking:history.title")}</Text>

        {isLoading && !booking ? (
          <Text tone="muted">{t("common:empty.title")}</Text>
        ) : (
          <>
            <StatusPill label={status.label} tone={status.tone} />
            {booking?.quoted_total_paise != null ? (
              <Text tone="primary">
                {t("booking:book.total", { amount: formatPaise(booking.quoted_total_paise) })}
              </Text>
            ) : null}

            <View className="flex-1 justify-end gap-sm pb-xl">
              {actions.includes("CONFIRM") ? (
                <Button
                  label={t("booking:actions.confirm")}
                  loading={transition.isPending}
                  onPress={() => act("CONFIRM")}
                  fullWidth
                />
              ) : null}
              {actions.includes("CANCEL") ? (
                <Button
                  label={t("common:actions.cancel")}
                  variant="secondary"
                  loading={transition.isPending}
                  onPress={() => act("CANCEL")}
                  fullWidth
                />
              ) : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
