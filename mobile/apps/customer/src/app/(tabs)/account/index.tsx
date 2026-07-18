import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { deleteAccountMutation } from "@sethu/api-client";
import { useSession } from "@sethu/core";
import { Screen, Text, Button, Card, Avatar, Icon, PressableScale } from "@sethu/ui";
import { useTranslation, type SupportedLanguage } from "@sethu/i18n";

import { LanguageSheet } from "@/features/settings/language-sheet";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
};

// Profile tab under a native large-title header — profile header, language switcher, and the Sign out
// / Delete Account actions (Delete required by App Store Guideline 5.1.1(v)). Richer menu in Phase 2.
export default function Account() {
  const { t, i18n } = useTranslation(["common", "auth"]);
  const router = useRouter();
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const { mutate, isPending } = useMutation(deleteAccountMutation());
  const [languageOpen, setLanguageOpen] = useState(false);

  const goToSignIn = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  const confirmDelete = () => {
    Alert.alert(t("auth:account.delete"), t("auth:account.deleteConfirm"), [
      { text: t("common:actions.cancel"), style: "cancel" },
      {
        text: t("common:actions.delete"),
        style: "destructive",
        onPress: () => mutate({}, { onSuccess: goToSignIn }),
      },
    ]);
  };

  const currentLanguage =
    (i18n.language as SupportedLanguage) in LANGUAGE_LABELS
      ? (i18n.language as SupportedLanguage)
      : "en";

  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <View className="gap-lg">
          <Card className="flex-row items-center gap-md">
            <Avatar name={user?.name} size={52} />
            <View className="flex-1">
              <Text variant="label">{user?.name || t("common:account.guest")}</Text>
              <Text variant="caption" tone="muted">
                {t("common:appName")}
              </Text>
            </View>
          </Card>

          <PressableScale onPress={() => setLanguageOpen(true)}>
            <Card className="flex-row items-center gap-md">
              <Icon name="globe" tone="primary" />
              <View className="flex-1">
                <Text variant="label">{t("common:account.language")}</Text>
                <Text variant="caption" tone="muted">
                  {LANGUAGE_LABELS[currentLanguage]}
                </Text>
              </View>
              <Icon name="chevronRight" tone="muted" />
            </Card>
          </PressableScale>

          <View className="gap-md pt-lg">
            <Button
              label={t("common:actions.signOut")}
              variant="secondary"
              icon="logout"
              onPress={goToSignIn}
              fullWidth
            />
            <Button
              label={t("auth:account.delete")}
              variant="destructive"
              icon="delete"
              loading={isPending}
              onPress={confirmDelete}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>

      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </Screen>
  );
}
