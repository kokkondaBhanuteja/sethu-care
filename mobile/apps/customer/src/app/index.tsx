import { View } from "react-native";
import { Screen, Text, Button, StatusPill } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Themed shell — proves the whole foundation renders together: the @sethu/ui design system on the
// Indigo Velvet tokens, and type-safe i18n. Real screens replace this in Phase 2+.
export default function Home() {
  const { t } = useTranslation(["common", "auth", "booking"]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-md px-mobile-margin">
        <Text variant="headline" tone="primary">
          {t("common:appName")}
        </Text>
        <Text variant="body" tone="muted">
          {t("common:empty.title")}
        </Text>
        <StatusPill label={t("booking:status.enRoute")} tone="active" />
        <Button label={t("auth:signIn.sendOtp")} fullWidth onPress={() => undefined} />
      </View>
    </Screen>
  );
}
