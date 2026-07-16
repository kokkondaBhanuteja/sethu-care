import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { TabBar, TabBarButton } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Bottom tab navigation for the provider app. Headless UI tabs + our token-styled TabBar. The
// job detail route (job/[id]) lives outside this group and stacks over the tabs via the root Stack.
export default function TabsLayout() {
  const { t } = useTranslation("common");
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabBarButton icon="service" label={t("nav.jobs")} />
          </TabTrigger>
          <TabTrigger name="earnings" href="/earnings" asChild>
            <TabBarButton icon="earnings" label={t("nav.earnings")} />
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabBarButton icon="account" label={t("nav.account")} />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}
