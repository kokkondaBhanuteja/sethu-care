import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { TabBar, TabBarButton } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Bottom tab navigation for the customer app. Uses expo-router's headless UI tabs so the bar is our
// own token-styled TabBar (teal active). Detail routes (service/[id], booking/[id], book/confirm)
// live outside this group and stack over the tabs via the root Stack.
export default function TabsLayout() {
  const { t } = useTranslation("common");
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabBarButton icon="home" label={t("nav.home")} />
          </TabTrigger>
          <TabTrigger name="bookings" href="/bookings" asChild>
            <TabBarButton icon="bookings" label={t("nav.bookings")} />
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabBarButton icon="account" label={t("nav.account")} />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}
