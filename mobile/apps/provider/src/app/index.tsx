import { View } from "react-native";
import { Screen, Text, Button, StatusPill } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Provider (technician) themed shell — same foundation as the customer app (shared @sethu/*
// packages, Indigo Velvet tokens, type-safe i18n). Real job screens replace this in Phase 4.
export default function Home() {
  const { t } = useTranslation(["common", "booking"]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-md px-mobile-margin">
        <Text variant="headline" tone="primary">
          {t("common:appName")}
        </Text>
        <StatusPill label={t("booking:status.inProgress")} tone="active" />
        <Button
          label={t("common:actions.continue")}
          variant="secondary"
          fullWidth
          onPress={() => undefined}
        />
      </View>
    </Screen>
  );
}
