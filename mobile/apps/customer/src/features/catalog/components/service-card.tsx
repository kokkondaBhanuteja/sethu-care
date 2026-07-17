import { View } from "react-native";
import { Text, Card, AppImage, RatingPill, Badge, Icon, PressableScale } from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import type { ServiceResponse } from "@sethu/api-client";

import { serviceImage, serviceIcon, sampleRating } from "../images";

// A rich, image-forward service card (Swiggy / Urban-Company style): a hero image with an offer
// badge, then the name + rating pill, duration + verified-pros data points, and the starting price.
// The image falls back to a soft-blue tile with the service's glyph until the real photo is added.
export function ServiceCard({
  service,
  onPress,
}: {
  service: ServiceResponse;
  onPress?: () => void;
}) {
  const { t } = useTranslation(["common", "booking"]);
  const firstVariant = service.variants?.[0];
  const price = firstVariant?.price_paise != null ? formatPaise(firstVariant.price_paise) : null;
  const rating = sampleRating(service.id);
  const minutes = service.estimated_minutes;

  return (
    <PressableScale onPress={onPress} accessibilityLabel={service.name}>
      <Card padded={false} className="overflow-hidden">
        <View>
          <AppImage
            source={serviceImage(service.slug)}
            placeholderIcon={serviceIcon(service.name)}
            style={{ width: "100%", height: 150 }}
          />
          <View className="absolute left-sm top-sm">
            <Badge label={t("common:home.verified")} tone="offer" />
          </View>
        </View>

        <View className="gap-1 p-md">
          <View className="flex-row items-start justify-between gap-sm">
            <Text variant="label" className="flex-1">
              {service.name ?? ""}
            </Text>
            <RatingPill rating={rating} count="2.1k" />
          </View>

          {service.description ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {service.description}
            </Text>
          ) : null}

          <View className="flex-row items-center gap-md pt-1">
            {minutes ? (
              <View className="flex-row items-center gap-1">
                <Icon name="clock" size={14} tone="muted" />
                <Text variant="caption" tone="muted">
                  {t("common:home.minutes", { count: minutes })}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1">
              <Icon name="shield" size={14} tone="secondary" />
              <Text variant="caption" tone="muted">
                {t("common:home.verifiedPros")}
              </Text>
            </View>
          </View>

          {price ? (
            <View className="flex-row items-center justify-between pt-xs">
              <Text variant="label" tone="primary">
                {t("common:home.startingAt", { price })}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text variant="caption" tone="primary">
                  {t("booking:book.cta")}
                </Text>
                <Icon name="chevronRight" size={14} tone="primary" />
              </View>
            </View>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}
