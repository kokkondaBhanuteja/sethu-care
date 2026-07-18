import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Text, Button, Card, TextField, Icon, Badge } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useSession, usePreferences } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";
import { AddressPicker } from "@/features/address";
import { useCreateBooking } from "@/features/booking";
import { computeCheckout } from "@/features/checkout";
import { openRazorpayCheckout, isRazorpayConfigured } from "@/features/payment";

// Checkout: chosen variant, a promo code / SETHU+ discount, an address, then a Razorpay (test-mode)
// payment. On a successful payment we create the booking and open its live status.
export default function Confirm() {
  const { variantId, variantName, pricePaise } = useLocalSearchParams<{
    variantId: string;
    variantName: string;
    pricePaise: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation(["booking", "common"]);
  const user = useSession((state) => state.user);
  const sethuPlus = usePreferences((state) => state.sethuPlus);
  const { mutate } = useCreateBooking();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const basePaise = Number(pricePaise ?? "0");
  const totals = useMemo(
    () => computeCheckout(basePaise, { promoCode: appliedPromo, isMember: sethuPlus }),
    [basePaise, appliedPromo, sethuPlus],
  );

  const applyPromo = () => {
    setAppliedPromo(promoInput.trim());
  };

  const onPay = async () => {
    if (!addressId || paying) return;
    if (!isRazorpayConfigured()) {
      setError(t("booking:pay.notConfigured"));
      return;
    }
    setError(undefined);
    setPaying(true);
    try {
      await openRazorpayCheckout({
        amountPaise: totals.finalPaise,
        description: variantName ?? t("booking:pay.title"),
        name: user?.name,
      });
      // Payment captured in test mode — create the booking and open its status.
      mutate(
        { body: { address_id: addressId, variant_id: variantId, quantity: 1 } },
        {
          onSuccess: (data) => {
            if (data.booking_id) {
              router.replace({ pathname: "/booking/[id]", params: { id: data.booking_id } });
            } else {
              router.replace("/");
            }
          },
          onError: () => {
            setError(t("common:errors.generic"));
            setPaying(false);
          },
        },
      );
    } catch {
      // User cancelled or the payment failed.
      setError(t("booking:pay.failed"));
      setPaying(false);
    }
  };

  const promoError = totals.invalidCode ? t("booking:pay.invalidPromo") : undefined;

  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <View className="gap-md">
          <Card className="gap-1">
            <Text variant="label">{variantName}</Text>
            <Text variant="caption" tone="muted">
              {formatPaise(basePaise)}
            </Text>
          </Card>

          {/* Promo code */}
          <View className="gap-sm">
            <View className="flex-row items-end gap-sm">
              <View className="flex-1">
                <TextField
                  label={t("booking:pay.promoLabel")}
                  value={promoInput}
                  onChangeText={(next) => setPromoInput(next.toUpperCase())}
                  error={promoError}
                  autoCapitalize="characters"
                  placeholder="SUMMER20"
                />
              </View>
              <Button
                label={t("booking:pay.apply")}
                variant="secondary"
                onPress={applyPromo}
                disabled={promoInput.trim().length === 0}
              />
            </View>
            {sethuPlus && !totals.appliedLabel?.startsWith("SETHU+") && !appliedPromo ? (
              <View className="flex-row items-center gap-1">
                <Icon name="shield" size={14} tone="primary" weight="fill" />
                <Text variant="caption" tone="muted">
                  {t("booking:pay.memberApplied")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Price breakdown */}
          <Card className="gap-sm">
            <View className="flex-row items-center justify-between">
              <Text variant="body" tone="muted">
                {t("booking:pay.subtotal")}
              </Text>
              <Text variant="body">{formatPaise(totals.basePaise)}</Text>
            </View>
            {totals.discountPaise > 0 ? (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-sm">
                  <Text variant="body" tone="muted">
                    {t("booking:pay.discount")}
                  </Text>
                  {totals.appliedLabel ? <Badge label={totals.appliedLabel} tone="accent" /> : null}
                </View>
                <Text variant="body" tone="primary">
                  −{formatPaise(totals.discountPaise)}
                </Text>
              </View>
            ) : null}
            <View className="mt-1 flex-row items-center justify-between border-t border-outline-variant pt-sm">
              <Text variant="label">{t("booking:pay.total")}</Text>
              <Text variant="headlineSm" tone="primary">
                {formatPaise(totals.finalPaise)}
              </Text>
            </View>
          </Card>

          <AddressPicker selectedId={addressId} onSelect={setAddressId} />

          {error ? (
            <Text variant="caption" tone="error">
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky pay bar */}
      <View className="border-t border-outline-variant bg-surface-container-lowest px-mobile-margin pb-lg pt-sm">
        <Button
          label={t("booking:pay.payNow", { amount: formatPaise(totals.finalPaise) })}
          icon="payment"
          loading={paying}
          disabled={!addressId}
          onPress={onPay}
          fullWidth
        />
      </View>
    </Screen>
  );
}
