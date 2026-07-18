import { NativeTabs } from "expo-router/unstable-native-tabs";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

// Native bottom tabs — the platform tab bar (iOS 26 Liquid Glass pill on iOS, Material bar on Android)
// via expo-router's NativeTabs, tinted with the brand blue. Icons are SF Symbols on iOS (`sf`) and
// Material glyphs on Android (`md`). Detail routes (service/[id], booking/[id], book/confirm,
// categories) stack over the tabs via the root Stack.
export default function TabsLayout() {
  const { t } = useTranslation("common");
  return (
    <NativeTabs tintColor={color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>{t("nav.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
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
