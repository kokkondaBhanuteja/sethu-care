import { ScrollView, View } from "react-native";
import { Screen, Text } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Offers tab — promo codes + SETHU+ membership. Filled in Phase 2; stub keeps the 4th native tab valid.
export default function Offers() {
  const { t } = useTranslation("common");
  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="gap-md px-mobile-margin pt-md">
          <Text variant="body" tone="muted">
            {t("offers.subtitle")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
