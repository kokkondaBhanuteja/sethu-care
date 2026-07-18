import { NativeTabs } from "expo-router/unstable-native-tabs";
import { color } from "@sethu/tokens";
import { useTranslation } from "@sethu/i18n";

// Native bottom tabs for the provider app — platform tab bar (iOS 26 Liquid Glass, Material on
// Android) tinted brand blue. SF Symbols on iOS (sf), Material glyphs on Android (md). The job
// detail route (job/[id]) stacks over the tabs via the root Stack.
export default function TabsLayout() {
  const { t } = useTranslation("common");
  return (
    <NativeTabs tintColor={color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "hammer", selected: "hammer.fill" }}
          md="handyman"
        />
        <NativeTabs.Trigger.Label>{t("nav.jobs")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="earnings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "indianrupeesign.circle", selected: "indianrupeesign.circle.fill" }}
          md="account_balance_wallet"
        />
        <NativeTabs.Trigger.Label>{t("nav.earnings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="person"
        />
        <NativeTabs.Trigger.Label>{t("nav.account")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
