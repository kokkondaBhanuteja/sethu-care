import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Text, Button } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import { AddressPicker } from "@/features/address";
import { useCreateBooking } from "@/features/booking";

// Confirm & book: shows the chosen variant, picks an address, and fires the optimistic booking.
export default function Confirm() {
  const { variantId, variantName, pricePaise } = useLocalSearchParams<{
    variantId: string;
    variantName: string;
    pricePaise: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation(["booking", "common"]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const { mutate, isPending } = useCreateBooking();

  const priceLabel = formatPaise(Number(pricePaise ?? "0"));

  const onBook = () => {
    if (!addressId) return;
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
      },
    );
  };

  return (
    <Screen>
      <View className="flex-1 gap-md px-mobile-margin pt-md">
        <Text variant="headline">{t("booking:book.cta")}</Text>

        <View className="rounded-card border border-outline-variant bg-surface-container-lowest p-md">
          <Text variant="label">{variantName}</Text>
          <Text tone="primary">{t("booking:book.total", { amount: priceLabel })}</Text>
        </View>

        <AddressPicker selectedId={addressId} onSelect={setAddressId} />

        <View className="flex-1 justify-end pb-xl">
          <Button
            label={t("booking:book.cta")}
            loading={isPending}
            disabled={!addressId}
            onPress={onBook}
            fullWidth
          />
        </View>
      </View>
    </Screen>
  );
}
