import { ScrollView, View } from "react-native";
import { Screen, Text } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Offers tab — promo codes + SETHU+ membership. Filled in Phase 2; stub keeps the 4th native tab valid.
export default function Offers() {
  const { t } = useTranslation("common");
  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-md px-mobile-margin pt-md">
          <Text variant="headline">{t("nav.offers")}</Text>
          <Text variant="body" tone="muted">
            {t("offers.subtitle")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
