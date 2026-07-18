import { ScrollView, View } from "react-native";
import { Screen, Text, Card, Badge, Button, Icon, type BadgeTone } from "@sethu/ui";
import { usePreferences } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";

// Static promotional offers (no backend yet) — headline, blurb and a copyable-looking promo code.
// Mirrors the Casa reference "Offers & rewards" tab. Copy is placeholder text until a coupon system.
type Offer = { code: string; title: string; blurb: string; badge: string; tone: BadgeTone };
const OFFERS: Offer[] = [
  {
    code: "SUMMER20",
    title: "20% off AC maintenance",
    blurb: "Beat the summer heat with a pro tune-up.",
    badge: "Limited",
    tone: "offer",
  },
  {
    code: "WELCOME",
    title: "₹100 off your first booking",
    blurb: "New to SETHU-CARE? This one's on us.",
    badge: "New",
    tone: "accent",
  },
  {
    code: "REFER10",
    title: "₹150 for every friend",
    blurb: "Share your code — you both get rewarded.",
    badge: "Refer",
    tone: "neutral",
  },
];

const MEMBERSHIP_PERKS = [
  "Save 15% on every booking",
  "Priority slots & background-verified pros",
  "Free re-visit within the warranty period",
];

export default function Offers() {
  const { t } = useTranslation("common");
  const sethuPlus = usePreferences((state) => state.sethuPlus);
  const setSethuPlus = usePreferences((state) => state.setSethuPlus);
  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View className="gap-md">
          {OFFERS.map((offer) => (
            <Card key={offer.code} className="gap-sm">
              <View className="flex-row items-center justify-between">
                <Badge label={offer.badge} tone={offer.tone} />
                <View className="flex-row items-center gap-1">
                  <Icon name="tag" size={16} tone="muted" />
                  <Text variant="caption" tone="muted">
                    {t("offers.code")}
                  </Text>
                </View>
              </View>
              <Text variant="label">{offer.title}</Text>
              <Text variant="caption" tone="muted">
                {offer.blurb}
              </Text>
              <View className="flex-row items-center justify-between pt-1">
                <View className="rounded-md border border-dashed border-outline-variant px-md py-1">
                  <Text variant="label" tone="primary">
                    {offer.code}
                  </Text>
                </View>
                <Button
                  label={t("offers.apply")}
                  variant="secondary"
                  size="sm"
                  onPress={() => {}}
                />
              </View>
            </Card>
          ))}

          {/* SETHU+ membership */}
          <Card className="gap-sm bg-primary">
            <View className="flex-row items-center gap-sm">
              <Icon name="shield" tone="inverse" weight="fill" />
              <Text variant="label" tone="inverse">
                SETHU+
              </Text>
            </View>
            {MEMBERSHIP_PERKS.map((perk) => (
              <View key={perk} className="flex-row items-center gap-sm">
                <Icon name="checkCircle" size={18} tone="inverse" weight="fill" />
                <Text variant="caption" tone="inverse" className="flex-1 opacity-90">
                  {perk}
                </Text>
              </View>
            ))}
            <View className="flex-row items-center gap-sm pt-1">
              <Button
                label={sethuPlus ? t("offers.memberJoined") : t("offers.member")}
                variant="secondary"
                size="sm"
                icon={sethuPlus ? "checkCircle" : undefined}
                onPress={() => setSethuPlus(!sethuPlus)}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
