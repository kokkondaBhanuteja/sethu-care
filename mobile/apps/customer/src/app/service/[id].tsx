import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Screen,
  Text,
  Button,
  Card,
  Icon,
  AppImage,
  RatingPill,
  Rating,
  Avatar,
  PressableScale,
} from "@sethu/ui";
import { formatPaise } from "@sethu/domain";
import { useTranslation } from "@sethu/i18n";
import { useService, servicePhoto, serviceIcon, sampleRating } from "@/features/catalog";

// Sample reviews — placeholder until a reviews-list endpoint exists (only POST /bookings/{id}/review
// is available today). Names/text are illustrative.
const SAMPLE_REVIEWS = [
  { name: "Aarti S.", rating: 5, text: "On time and very professional. My AC works like new." },
  { name: "Rahul M.", rating: 5, text: "Transparent pricing and genuine parts. Highly recommend." },
  {
    name: "Priya K.",
    rating: 4,
    text: "Good service — the technician explained everything clearly.",
  },
];

// Rich service detail: a hero image, name + rating, duration/warranty/visit-fee data points, a
// "What's included" checklist, reviews, selectable variant options, and a sticky "Book now" bar that
// carries the chosen variant to the confirm screen.
export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(["booking", "common"]);
  const { data: service } = useService(id ?? "");
  const variants = service?.variants ?? [];

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  const included = [
    t("booking:detail.inc1"),
    t("booking:detail.inc2"),
    t("booking:detail.inc3"),
    t("booking:detail.inc4"),
  ];

  // Go back when there's history, otherwise fall back to Home — the detail screen can be the stack
  // root (deep link, or a dev fast-refresh that reset navigation), where router.back() has nothing to
  // pop and Expo Router raises a "GO_BACK was not handled" error toast.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const book = () => {
    if (!selected) return;
    router.push({
      pathname: "/book/confirm",
      params: {
        variantId: selected.id ?? "",
        variantName: selected.name ?? "",
        pricePaise: String(selected.price_paise ?? 0),
      },
    });
  };

  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Hero — full-bleed under the transparent native header (back button floats over it). */}
        <AppImage
          source={servicePhoto(service?.slug)}
          placeholderIcon={serviceIcon(service?.name)}
          contentFit="cover"
          style={{ width: "100%", height: 260 }}
        />

        <View className="gap-md px-mobile-margin pt-md">
          <View className="gap-1">
            <Text variant="headline">{service?.name ?? ""}</Text>
            <RatingPill rating={sampleRating(service?.id)} count="2.1k" size="md" />
            {service?.description ? (
              <Text variant="body" tone="muted" className="pt-1">
                {service.description}
              </Text>
            ) : null}
          </View>

          {/* Data points */}
          <View className="flex-row gap-sm">
            <Card padded={false} className="flex-1 items-center gap-1 py-md">
              <Text variant="caption" tone="muted">
                {t("booking:detail.duration")}
              </Text>
              <Text variant="label">
                {service?.estimated_minutes
                  ? t("booking:detail.minutes", { count: service.estimated_minutes })
                  : "—"}
              </Text>
            </Card>
            <Card padded={false} className="flex-1 items-center gap-1 py-md">
              <Text variant="caption" tone="muted">
                {t("booking:detail.warranty")}
              </Text>
              <Text variant="label">{t("booking:detail.warrantyValue")}</Text>
            </Card>
            <Card padded={false} className="flex-1 items-center gap-1 py-md">
              <Text variant="caption" tone="muted">
                {t("booking:detail.visitFee")}
              </Text>
              <Text variant="label" tone="primary">
                {variants[0]?.price_paise != null ? formatPaise(variants[0].price_paise) : "—"}
              </Text>
            </Card>
          </View>

          {/* What's included */}
          <View className="gap-sm">
            <Text variant="headlineSm">{t("booking:detail.included")}</Text>
            {included.map((line) => (
              <View key={line} className="flex-row items-center gap-sm">
                <Icon name="checkCircle" tone="secondary" size={20} weight="fill" />
                <Text variant="body">{line}</Text>
              </View>
            ))}
          </View>

          {/* Reviews */}
          <View className="gap-sm">
            <View className="flex-row items-center justify-between">
              <Text variant="headlineSm">{t("booking:detail.reviews")}</Text>
              <RatingPill rating={sampleRating(service?.id)} count="2.1k" size="md" />
            </View>
            {SAMPLE_REVIEWS.map((review) => (
              <Card key={review.name} className="gap-sm">
                <View className="flex-row items-center gap-sm">
                  <Avatar name={review.name} size={36} />
                  <View className="flex-1">
                    <Text variant="label">{review.name}</Text>
                    <Rating value={review.rating} readOnly />
                  </View>
                </View>
                <Text variant="body" tone="muted">
                  {review.text}
                </Text>
              </Card>
            ))}
          </View>

          {/* Options */}
          {variants.length > 0 ? (
            <View className="gap-sm">
              <Text variant="headlineSm">{t("booking:detail.selectOption")}</Text>
              {variants.map((variant) => {
                const isSelected = (selected?.id ?? "") === variant.id;
                return (
                  <PressableScale
                    key={variant.id}
                    onPress={() => setSelectedId(variant.id)}
                    accessibilityLabel={variant.name}
                  >
                    <Card
                      className={`flex-row items-center justify-between gap-md ${
                        isSelected ? "border-primary" : ""
                      }`}
                    >
                      <View className="flex-1 flex-row items-center gap-sm">
                        <Icon
                          name={isSelected ? "checkCircle" : "plus"}
                          tone={isSelected ? "primary" : "muted"}
                          weight={isSelected ? "fill" : "regular"}
                        />
                        <Text variant="label">{variant.name ?? ""}</Text>
                      </View>
                      {variant.price_paise != null ? (
                        <Text variant="label" tone="primary">
                          {formatPaise(variant.price_paise)}
                        </Text>
                      ) : null}
                    </Card>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating back button — sits over the hero; a white pill keeps it readable on any image. */}
      <PressableScale
        onPress={goBack}
        accessibilityLabel={t("common:actions.back")}
        scaleTo={0.9}
        style={{ position: "absolute", top: insets.top + 8, left: 16 }}
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest shadow-md shadow-inverse-surface/20">
          <Icon name="back" size={22} tone="primary" />
        </View>
      </PressableScale>

      {/* Sticky book bar */}
      {selected ? (
        <View className="flex-row items-center justify-between gap-md border-t border-outline-variant bg-surface-container-lowest px-mobile-margin pb-lg pt-sm">
          <View>
            <Text variant="caption" tone="muted">
              {t("booking:detail.startingAt", {
                amount: selected.price_paise != null ? formatPaise(selected.price_paise) : "",
              })}
            </Text>
            <Text variant="label">{selected.name ?? ""}</Text>
          </View>
          <Button label={t("booking:book.cta")} onPress={book} />
        </View>
      ) : null}
    </Screen>
  );
}
