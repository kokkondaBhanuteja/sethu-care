import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Text, Button, StatusPill, TextField, Rating, type StatusTone } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";

import { useBooking, useTransitionBooking } from "@/features/booking";
import { useBookingPayment } from "@/features/payment";
import { useSubmitReview } from "@/features/reviews";

// A booking's live status. useBooking polls every 4s, so the pill updates as the backend advances
// the state machine. Once completed, the customer can pay any pending UPI collection and rate the
// service. Allowed actions (from the booking) render as buttons.
export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id ?? "";
  const { t } = useTranslation(["booking", "common"]);
  const { data: booking, isLoading } = useBooking(bookingId);
  const transition = useTransitionBooking(bookingId);

  const state = booking?.state ?? "";
  const actions = booking?.allowed_actions ?? [];
  const completed = state === "COMPLETED";

  const payment = useBookingPayment(bookingId, completed);
  const submitReview = useSubmitReview(bookingId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-md px-mobile-margin pt-md pb-2xl">
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

              {/* Pending UPI collection to pay (completed bookings only; cash has none). */}
              {completed && payment.data ? (
                <View className="gap-sm rounded-card border border-outline-variant p-md">
                  <Text variant="label">{t("booking:payment.title")}</Text>
                  {payment.data.status === "CAPTURED" ? (
                    <StatusPill label={t("booking:payment.paid")} tone="success" />
                  ) : (
                    <>
                      {payment.data.amount ? (
                        <Text variant="body">
                          {t("booking:payment.amount", { amount: `₹${payment.data.amount}` })}
                        </Text>
                      ) : null}
                      {payment.data.reference ? (
                        <Text variant="caption" tone="muted">
                          {t("booking:payment.reference", { reference: payment.data.reference })}
                        </Text>
                      ) : null}
                      {payment.data.upi_link ? (
                        <Button
                          label={t("booking:payment.payNow")}
                          onPress={() =>
                            payment.data?.upi_link &&
                            void Linking.openURL(payment.data.upi_link).catch(() => {})
                          }
                          fullWidth
                        />
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}

              {/* Rate the service (completed bookings only). */}
              {completed ? (
                <View className="gap-sm rounded-card border border-outline-variant p-md">
                  <Text variant="label">{t("booking:review.title")}</Text>
                  {submitReview.isSuccess ? (
                    <>
                      <Rating value={rating} readOnly />
                      <Text variant="caption" tone="muted">
                        {t("booking:review.thanks")}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Rating value={rating} onChange={setRating} />
                      <TextField
                        value={comment}
                        onChangeText={setComment}
                        placeholder={t("booking:review.commentPlaceholder")}
                        multiline
                        numberOfLines={3}
                      />
                      <Button
                        label={t("booking:review.submit")}
                        loading={submitReview.isPending}
                        disabled={rating === 0}
                        onPress={() =>
                          submitReview.mutate({
                            path: { id: bookingId },
                            body: { rating, comment },
                          })
                        }
                        fullWidth
                      />
                    </>
                  )}
                </View>
              ) : null}

              <View className="gap-sm pt-md">
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
      </ScrollView>
    </Screen>
  );
}
