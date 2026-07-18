import { Stack } from "expo-router";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

// Native stack for the Offers tab — large-title header (iOS) / standard header (Android).
export default function OffersStackLayout() {
  const { t } = useTranslation("common");
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerTintColor: color.primary,
        headerLargeTitleStyle: { color: color.onSurface },
        headerTitleStyle: { color: color.onSurface },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("nav.offers") }} />
    </Stack>
  );
}
