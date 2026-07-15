import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Text, Button, StatusPill } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Authenticated home shell — behind the auth gate. Real catalog/booking screens replace this in
// Phase 3. For now it proves the design system + i18n render and links to Settings (Delete Account).
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);
  const router = useRouter();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-md px-mobile-margin">
        <Text variant="headline" tone="primary">
          {t("common:appName")}
        </Text>
        <StatusPill label={t("booking:status.enRoute")} tone="active" />
        <Button label={t("common:actions.settings")} variant="secondary" onPress={() => router.push("/settings")} />
      </View>
    </Screen>
  );
}
