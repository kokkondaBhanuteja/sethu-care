import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Screen, Illustration, Text, Button } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Catch-all for unmatched routes (expo-router renders this automatically). Shows the "not found" clay
// illustration with a way back home.
export default function NotFound() {
  const { t } = useTranslation("common");
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <Screen edges={["bottom"]}>
        <View className="flex-1 items-center justify-center gap-md px-mobile-margin">
          <Illustration name="notFound" size={200} />
          <Text variant="headlineSm">{t("notFound.title")}</Text>
          <Text variant="body" tone="muted" className="text-center">
            {t("notFound.subtitle")}
          </Text>
          <View className="pt-sm">
            <Button label={t("notFound.home")} icon="home" onPress={() => router.replace("/")} />
          </View>
        </View>
      </Screen>
    </>
  );
}
