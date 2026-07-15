import { Pressable, View } from "react-native";
import { Text } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import type { ServiceResponse } from "@sethu/api-client";

// A catalog service card: name, description, and the starting price (first variant). Presentational
// — the screen wires the tap.
export function ServiceCard({ service, onPress }: { service: ServiceResponse; onPress?: () => void }) {
  const firstVariant = service.variants?.[0];
  const price = firstVariant?.price_paise != null ? formatPaise(firstVariant.price_paise) : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={service.name}>
      <View className="rounded-card border border-outline-variant bg-surface-container-lowest p-md">
        <Text variant="headlineSm">{service.name ?? ""}</Text>
        {service.description ? (
          <Text variant="body" tone="muted" className="mt-1">
            {service.description}
          </Text>
        ) : null}
        {price ? (
          <Text variant="label" tone="primary" className="mt-sm">
            {price}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
