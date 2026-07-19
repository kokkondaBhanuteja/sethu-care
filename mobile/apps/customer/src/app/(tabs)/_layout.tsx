import { Tabs } from "expo-router/js-tabs";

import { CustomTabBar } from "@/components/custom-tab-bar";

// Bottom tabs with a custom floating pill bar + centre "Book Now" FAB (see CustomTabBar). We render
// our own bar instead of the native one so a primary action can sit in the middle. Each tab's screen
// keeps its own native Stack (large titles / glass headers) via its folder _layout.
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="offers" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
