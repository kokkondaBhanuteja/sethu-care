import { Stack } from "expo-router";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

// Native stack for the Bookings tab — gives the screen a native large-title header (iOS) / standard
// header (Android) while the native tab bar stays put.
export default function BookingsStackLayout() {
  const { t } = useTranslation("booking");
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
      <Stack.Screen name="index" options={{ title: t("history.title") }} />
    </Stack>
  );
}
