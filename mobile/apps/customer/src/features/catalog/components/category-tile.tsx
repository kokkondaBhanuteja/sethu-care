import { View } from "react-native";
import { Text, AppImage, PressableScale } from "@sethu/ui";
import type { ServiceResponse } from "@sethu/api-client";

import { serviceImage, serviceIcon } from "../images";

// A category tile for the "What needs fixing?" grid: a rounded image (or soft-blue glyph fallback)
// above a short label. Sized to fit four per row.
export function CategoryTile({
  service,
  onPress,
}: {
  service: ServiceResponse;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={service.name}>
      <View className="items-center gap-1" style={{ width: 76 }}>
        <AppImage
          source={serviceImage(service.slug)}
          placeholderIcon={serviceIcon(service.name)}
          contentFit="contain"
          style={{ width: 68, height: 68, borderRadius: 22 }}
        />
        <Text variant="caption" tone="default" numberOfLines={2} className="text-center">
          {service.name ?? ""}
        </Text>
      </View>
    </PressableScale>
  );
}
