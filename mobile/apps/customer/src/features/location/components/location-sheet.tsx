import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { AddressResponse } from "@sethu/api-client";
import { usePreferences } from "@sethu/core";
import {
  Sheet,
  Text,
  Button,
  TextField,
  Icon,
  PressableScale,
  Skeleton,
  type IconName,
} from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useAddresses, useCreateAddress } from "../api";

// Picks an icon from the address label so Home/Work read at a glance, like the food apps.
function iconForLabel(label?: string): IconName {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("home") || normalized.includes("घर") || normalized.includes("ఇల్ల")) {
    return "home";
  }
  if (normalized.includes("work") || normalized.includes("office")) return "briefcase";
  return "location";
}

function addressSummary(address: AddressResponse): string {
  return [address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ");
}

// The location picker: a list of the customer's saved addresses (tap to select) plus an "Add new
// address" flow. Selecting persists the choice to preferences; the header reflects it immediately.
export interface LocationSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LocationSheet({ visible, onClose }: LocationSheetProps) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<"list" | "add">("list");
  const close = () => {
    setMode("list");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={mode === "add" ? t("address.add") : t("address.select")}
    >
      {mode === "add" ? (
        <AddressForm onDone={() => setMode("list")} />
      ) : (
        <AddressList onAddNew={() => setMode("add")} onSelected={close} />
      )}
    </Sheet>
  );
}

function AddressList({ onAddNew, onSelected }: { onAddNew: () => void; onSelected: () => void }) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useAddresses();
  const selectedId = usePreferences((state) => state.selectedAddressId);
  const setSelectedAddressId = usePreferences((state) => state.setSelectedAddressId);
  const addresses = data?.addresses ?? [];

  const select = (id?: string) => {
    if (!id) return;
    setSelectedAddressId(id);
    onSelected();
  };

  return (
    <View className="px-mobile-margin pb-md pt-xs">
      <Text variant="label" tone="muted" className="pb-sm">
        {t("address.saved")}
      </Text>

      {isLoading ? (
        <View className="gap-sm">
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
        </View>
      ) : addresses.length === 0 ? (
        <Text variant="body" tone="muted" className="py-md">
          {t("address.empty")}
        </Text>
      ) : (
        <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
          <View className="gap-sm">
            {addresses.map((address) => {
              const isSelected = address.id === selectedId;
              return (
                <PressableScale
                  key={address.id}
                  onPress={() => select(address.id)}
                  accessibilityLabel={address.label ?? address.line1}
                >
                  <View
                    className={`flex-row items-center gap-md rounded-card border p-md ${
                      isSelected
                        ? "border-primary bg-primary-container/40"
                        : "border-outline-variant"
                    }`}
                  >
                    <Icon
                      name={iconForLabel(address.label)}
                      tone={isSelected ? "primary" : "muted"}
                    />
                    <View className="flex-1">
                      <Text variant="label">{address.label || t("address.select")}</Text>
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {addressSummary(address)}
                      </Text>
                    </View>
                    {isSelected ? <Icon name="checkCircle" tone="primary" weight="fill" /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View className="pt-md">
        <Button
          label={t("address.addNew")}
          icon="plus"
          variant="secondary"
          onPress={onAddNew}
          fullWidth
        />
      </View>
    </View>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("common");
  const { mutate, isPending } = useCreateAddress();
  const setSelectedAddressId = usePreferences((state) => state.setSelectedAddressId);
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const canSave = line1.trim().length > 0 && city.trim().length > 0 && pincode.trim().length === 6;

  const save = () => {
    mutate(
      {
        body: {
          label: label.trim() || undefined,
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          pincode: pincode.trim(),
        },
      },
      {
        onSuccess: (created) => {
          if (created?.id) setSelectedAddressId(created.id);
          onDone();
        },
      },
    );
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-mobile-margin pb-md pt-xs">
      <ScrollView
        className="max-h-96"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-md">
          <TextField
            label={t("address.label")}
            value={label}
            onChangeText={setLabel}
            placeholder="Home"
          />
          <TextField label={t("address.line1")} value={line1} onChangeText={setLine1} />
          <TextField label={t("address.line2")} value={line2} onChangeText={setLine2} />
          <View className="flex-row gap-md">
            <View className="flex-1">
              <TextField label={t("address.city")} value={city} onChangeText={setCity} />
            </View>
            <View className="flex-1">
              <TextField
                label={t("address.pincode")}
                value={pincode}
                onChangeText={(next) => setPincode(next.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="pt-md">
        <Button
          label={t("actions.save")}
          loading={isPending}
          disabled={!canSave}
          onPress={save}
          fullWidth
        />
      </View>
    </Animated.View>
  );
}
