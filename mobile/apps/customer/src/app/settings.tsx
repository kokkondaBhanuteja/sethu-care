import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { deleteAccountMutation } from "@sethu/api-client";
import { useSession } from "@sethu/core";
import { Screen, Text, Button } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Settings — houses Sign out and the in-app Delete Account flow required by App Store Guideline
// 5.1.1(v). Delete asks for explicit confirmation, then anonymises the account server-side and
// signs out.
export default function Settings() {
  const { t } = useTranslation(["auth", "common"]);
  const router = useRouter();
  const signOut = useSession((state) => state.signOut);
  const { mutate, isPending } = useMutation(deleteAccountMutation());

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

  return (
    <Screen>
      <View className="flex-1 gap-md px-mobile-margin pt-lg">
        <Text variant="headline">{t("common:actions.settings")}</Text>
        <View className="flex-1 justify-end gap-md pb-xl">
          <Button
            label={t("common:actions.signOut")}
            variant="secondary"
            onPress={goToSignIn}
            fullWidth
          />
          <Button
            label={t("auth:account.delete")}
            variant="destructive"
            loading={isPending}
            onPress={confirmDelete}
            fullWidth
          />
        </View>
      </View>
    </Screen>
  );
}
