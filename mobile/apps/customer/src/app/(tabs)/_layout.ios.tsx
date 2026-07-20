import { NativeTabs } from "expo-router/unstable-native-tabs";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

// iOS: the system-native tab bar — real iOS 26 Liquid Glass, drawn entirely by iOS (no third-party
// glass, no custom bar). Standard 4 tabs with SF Symbols. Android resolves _layout.tsx instead, which
// renders the custom notched FAB bar (native Liquid Glass isn't available off iOS).
export default function TabsLayout() {
  const { t } = useTranslation("common");
  return (
    <NativeTabs tintColor={color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>{t("nav.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="event" />
        <NativeTabs.Trigger.Label>{t("nav.bookings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="offers">
        <NativeTabs.Trigger.Icon sf={{ default: "tag", selected: "tag.fill" }} md="local_offer" />
        <NativeTabs.Trigger.Label>{t("nav.offers")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="person"
        />
        <NativeTabs.Trigger.Label>{t("nav.profile")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
