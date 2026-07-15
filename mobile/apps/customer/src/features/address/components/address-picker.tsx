import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text, Button } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useAddresses, useCreateAddress } from "../api";

// Pick a saved address or add one inline. The demo has no geolocation, so a new address defaults to
// Bengaluru coordinates; the backend needs line1 + city, the rest is optional.
export function AddressPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const { data } = useAddresses();
  const addresses = data?.addresses ?? [];
  const createAddress = useCreateAddress();
  const [adding, setAdding] = useState(false);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("Bengaluru");

  const onAdd = () => {
    if (!line1 || !city) return;
    createAddress.mutate(
      { body: { line1, city, lat: 12.97, lng: 77.59, is_default: true } },
      {
        onSuccess: (address) => {
          if (address.id) onSelect(address.id);
          setAdding(false);
          setLine1("");
        },
      },
    );
  };

  return (
    <View className="gap-sm">
      <Text variant="label" tone="muted">
        {t("address.select")}
      </Text>
      {addresses.map((address) => (
        <Pressable
          key={address.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedId === address.id }}
          onPress={() => address.id && onSelect(address.id)}
          className={`rounded-md border p-sm ${selectedId === address.id ? "border-primary bg-primary/10" : "border-outline-variant"}`}
        >
          <Text variant="label">{address.line1}</Text>
          <Text variant="caption" tone="muted">
            {address.city}
          </Text>
        </Pressable>
      ))}

      {adding ? (
        <View className="gap-sm rounded-md border border-outline-variant p-sm">
          <TextInput
            value={line1}
            onChangeText={setLine1}
            placeholder={t("address.line1")}
            className="rounded-md border border-outline-variant px-sm py-sm font-body text-body-md text-on-surface"
          />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t("address.city")}
            className="rounded-md border border-outline-variant px-sm py-sm font-body text-body-md text-on-surface"
          />
          <Button label={t("actions.save")} size="sm" loading={createAddress.isPending} onPress={onAdd} />
        </View>
      ) : (
        <Button label={t("address.add")} variant="secondary" size="sm" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
