import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@sethu/i18n";

// Themed shell — proves the foundation wires together end to end: NativeWind + the Indigo Velvet
// tokens (bg-background / text-primary / px-mobile-margin) and type-safe i18n (t('appName')).
// Real screens replace this in Phase 2+.
export default function Home() {
  const { t } = useTranslation("common");

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-mobile-margin">
        <Text className="font-heading text-headline-md text-primary">{t("appName")}</Text>
        <Text className="mt-sm text-body-md text-on-surface-variant">{t("empty.title")}</Text>
      </View>
    </SafeAreaView>
  );
}
