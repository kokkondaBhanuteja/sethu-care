import { View } from "react-native";
import { Text, Card, Icon, PressableScale } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import type { ServiceResponse } from "@sethu/api-client";

// A catalog service card: a soft icon tile, the name + description, the starting price (first
// variant), and a chevron affordance. Presentational — the screen wires the tap.
export function ServiceCard({
  service,
  onPress,
}: {
  service: ServiceResponse;
  onPress?: () => void;
}) {
  const firstVariant = service.variants?.[0];
  const price = firstVariant?.price_paise != null ? formatPaise(firstVariant.price_paise) : null;

  return (
    <PressableScale onPress={onPress} accessibilityLabel={service.name}>
      <Card className="flex-row items-center gap-md">
        <View className="h-12 w-12 items-center justify-center rounded-card bg-primary-container">
          <Icon name="service" tone="primary" size={24} />
        </View>
        <View className="flex-1">
          <Text variant="label">{service.name ?? ""}</Text>
          {service.description ? (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {service.description}
            </Text>
          ) : null}
          {price ? (
            <Text variant="label" tone="primary" className="pt-1">
              {price}
            </Text>
          ) : null}
        </View>
        <Icon name="chevronRight" tone="muted" />
      </Card>
    </PressableScale>
  );
}
